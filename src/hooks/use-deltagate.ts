import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import type { RuleCheck, Thresholds } from "@/lib/engine";
import { DEFAULT_THRESHOLDS } from "@/lib/settings-schema";

export type Reading = Database["public"]["Tables"]["sensor_readings"]["Row"];
export type GateEvent = Database["public"]["Tables"]["gate_events"]["Row"];
export type GateCommand = Database["public"]["Tables"]["gate_commands"]["Row"];
export type RainObs = Database["public"]["Tables"]["rain_observations"]["Row"];
export type DataSourceRow = Database["public"]["Tables"]["data_sources"]["Row"];
export type SettingsRow = Database["public"]["Tables"]["settings"]["Row"];
export type GateStateRow = Database["public"]["Tables"]["gate_state"]["Row"];

/** Current time, ticking. Null until mounted so server and client render the same markup. */
export function useNow(intervalMs = 15_000): number | null {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

async function must<T>(p: PromiseLike<{ data: T; error: { message: string } | null }>): Promise<T> {
  const { data, error } = await p;
  if (error) throw new Error(error.message);
  return data;
}

export function useSettings() {
  return useQuery({
    queryKey: ["settings"],
    queryFn: () => must(supabase.from("settings").select("*").eq("id", 1).single()),
  });
}

export function useThresholds(): Thresholds {
  const { data } = useSettings();
  return data
    ? {
        danger_level: data.danger_level,
        drain_start: data.drain_start,
        drain_stop: data.drain_stop,
        min_head: data.min_head,
        salinity_limit: data.salinity_limit,
        rain_alert_3h: data.rain_alert_3h,
      }
    : DEFAULT_THRESHOLDS;
}

export function useGateState() {
  return useQuery({
    queryKey: ["gate_state"],
    queryFn: async () => {
      const row = await must(supabase.from("gate_state").select("*").eq("id", 1).single());
      if (!row) throw new Error("gate_state row missing");
      return { ...row, checks: (row.checks ?? []) as unknown as RuleCheck[] };
    },
  });
}

export function useLatestReading() {
  return useQuery({
    queryKey: ["latest"],
    queryFn: () =>
      must(
        supabase
          .from("sensor_readings")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ),
  });
}

export function useLatestRain() {
  return useQuery({
    queryKey: ["rain", "latest"],
    queryFn: () =>
      must(
        supabase
          .from("rain_observations")
          .select("*")
          .order("observed_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ),
  });
}

export function useDataSources() {
  return useQuery({
    queryKey: ["sources"],
    queryFn: () => must(supabase.from("data_sources").select("*")),
  });
}

export function useRecentEvents(limit = 5) {
  return useQuery({
    queryKey: ["events", "recent", limit],
    queryFn: () =>
      must(
        supabase.from("gate_events").select("*").order("created_at", { ascending: false }).limit(limit),
      ),
  });
}

export function useCommands(limit = 12) {
  return useQuery({
    queryKey: ["commands", limit],
    queryFn: () =>
      must(
        supabase
          .from("gate_commands")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(limit),
      ),
  });
}

export function useHardwareDevice() {
  const { data } = useQuery({
    queryKey: ["latest", "device"],
    queryFn: () =>
      must(
        supabase
          .from("sensor_readings")
          .select("device_id, created_at")
          .not("device_id", "in", "(sample,sim-01)")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ),
  });
  return data ?? null;
}

// ---------- Time ranges and series ----------
export type RangeKey = "24h" | "7d" | "30d" | "custom";
export interface RangeSpec {
  key: RangeKey;
  from?: number;
  to?: number;
}

export function resolveRange(r: RangeSpec, now: number) {
  const span = r.key === "24h" ? 864e5 : r.key === "7d" ? 7 * 864e5 : 30 * 864e5;
  const to = r.key === "custom" && r.to ? r.to : now;
  const from = r.key === "custom" && r.from ? r.from : to - span;
  const len = to - from;
  const bucketSec =
    r.key === "24h"
      ? 300
      : r.key === "7d"
        ? 1800
        : r.key === "30d"
          ? 7200
          : Math.max(300, Math.round(len / 1000 / 300 / 300) * 300);
  return { from, to, bucketSec };
}

export interface SeriesPoint {
  t: number;
  h_out: number | null;
  h_in: number | null;
  ec_river: number | null;
  ec_polder: number | null;
  max_h_out: number | null;
  max_h_in: number | null;
  gate: number | null;
}
export interface RainPoint {
  t: number;
  rain_mm: number;
}
export interface Band {
  x1: number;
  x2: number;
}

export function useSeries(range: RangeSpec) {
  return useQuery({
    queryKey: ["series", range.key, range.from ?? 0, range.to ?? 0],
    queryFn: async () => {
      const { from, to, bucketSec } = resolveRange(range, Date.now());
      const args = {
        p_from: new Date(from).toISOString(),
        p_to: new Date(to).toISOString(),
        p_bucket_seconds: bucketSec,
      };
      const [r, rain] = await Promise.all([
        must(supabase.rpc("readings_bucketed", args)),
        must(supabase.rpc("rain_bucketed", args)),
      ]);
      const step = bucketSec * 1000;
      const points: SeriesPoint[] = [];
      let prevT: number | null = null;
      for (const b of r ?? []) {
        const t = Date.parse(b.bucket);
        // Break the line across gaps (no data) instead of drawing a straight bridge.
        if (prevT !== null && t - prevT > Math.max(3 * step, 45 * 60_000)) {
          points.push({
            t: prevT + step,
            h_out: null,
            h_in: null,
            ec_river: null,
            ec_polder: null,
            max_h_out: null,
            max_h_in: null,
            gate: null,
          });
        }
        points.push({
          t,
          h_out: b.h_out,
          h_in: b.h_in,
          ec_river: b.ec_river,
          ec_polder: b.ec_polder,
          max_h_out: b.max_h_out,
          max_h_in: b.max_h_in,
          gate: b.max_gate_pct,
        });
        prevT = t;
      }
      const bands: Band[] = [];
      let open: number | null = null;
      for (const p of points) {
        if (p.gate !== null && p.gate > 0) {
          if (open === null) open = p.t;
        } else if (open !== null) {
          bands.push({ x1: open, x2: p.t });
          open = null;
        }
      }
      if (open !== null) bands.push({ x1: open, x2: (points.at(-1)?.t ?? open) + step });
      const rainPts: RainPoint[] = (rain ?? []).map((x) => ({
        t: Date.parse(x.bucket),
        rain_mm: Math.round((x.rain_mm ?? 0) * 100) / 100,
      }));
      return { from, to, bucketSec, points, bands, rain: rainPts };
    },
    placeholderData: (prev) => prev,
  });
}

export function useEventsBetween(from: number, to: number, key: string) {
  return useQuery({
    queryKey: ["events", "range", key],
    queryFn: async () => {
      const [inRange, before] = await Promise.all([
        must(
          supabase
            .from("gate_events")
            .select("*")
            .gte("created_at", new Date(from).toISOString())
            .lte("created_at", new Date(to).toISOString())
            .order("created_at", { ascending: true })
            .limit(1000),
        ),
        must(
          supabase
            .from("gate_events")
            .select("*")
            .lt("created_at", new Date(from).toISOString())
            .order("created_at", { ascending: false })
            .limit(1),
        ),
      ]);
      return { events: inRange ?? [], before: before?.[0] ?? null };
    },
    placeholderData: (prev) => prev,
  });
}

// ---------- Realtime ----------
/** One subscription for the whole app. Invalidates the matching queries when rows change. */
export function useRealtimeSync() {
  const qc = useQueryClient();
  const lastSeries = useRef(0);
  useEffect(() => {
    const bumpSeries = () => {
      const now = Date.now();
      if (now - lastSeries.current > 20_000) {
        lastSeries.current = now;
        void qc.invalidateQueries({ queryKey: ["series"] });
      }
    };
    const channel = supabase
      .channel(`deltagate-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "sensor_readings" }, (p) => {
        qc.setQueryData(["latest"], p.new as Reading);
        void qc.invalidateQueries({ queryKey: ["latest", "device"] });
        bumpSeries();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "gate_events" }, () => {
        void qc.invalidateQueries({ queryKey: ["events"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "gate_commands" }, () => {
        void qc.invalidateQueries({ queryKey: ["commands"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "gate_state" }, () => {
        void qc.invalidateQueries({ queryKey: ["gate_state"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "data_sources" }, () => {
        void qc.invalidateQueries({ queryKey: ["sources"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "settings" }, () => {
        void qc.invalidateQueries({ queryKey: ["settings"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "rain_observations" }, () => {
        void qc.invalidateQueries({ queryKey: ["rain"] });
        bumpSeries();
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [qc]);
}
