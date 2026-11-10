// Runs one source fetcher and stores the result in data_sources (and rain rows for GPM).
import type { Admin } from "../gate.server";
import type { SourceId, SourceSyncResult } from "../sources";
import { fetchGpmImerg } from "./gpm.server";
import { fetchSwot } from "./swot.server";
import { fetchSentinel1 } from "./sentinel1.server";
import { fetchSrtm } from "./srtm.server";

export async function syncSource(admin: Admin, id: SourceId): Promise<SourceSyncResult> {
  const { data: s } = await admin.from("settings").select("latitude, longitude").eq("id", 1).single();
  const lat = s?.latitude ?? 22.5;
  const lon = s?.longitude ?? 89.47;
  let result: SourceSyncResult;

  if (id === "esp32") {
    // Sensors push to /api/public/ingest-reading; "sync" just re-reads the newest row.
    const { data: r } = await admin
      .from("sensor_readings")
      .select("created_at, device_id")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    result = {
      source_id: "esp32",
      ok: !!r,
      mock: false,
      synced_at: r?.created_at ?? new Date().toISOString(),
      newest_observation_at: r?.created_at ?? null,
      observations: r ? 1 : 0,
      payload: { device_id: r?.device_id ?? null },
      message: r ? "Newest reading checked" : "No readings yet",
    };
  } else if (id === "gpm_imerg") {
    const { data: last } = await admin
      .from("rain_observations")
      .select("observed_at")
      .order("observed_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const { result: r, rows } = await fetchGpmImerg({
      lat,
      lon,
      lastObservedAt: last?.observed_at ?? null,
    });
    if (rows.length) {
      const ins = await admin.from("rain_observations").upsert(rows, { onConflict: "observed_at" });
      if (ins.error) throw new Error(`rain_observations: ${ins.error.message}`);
    }
    result = r;
  } else if (id === "swot") {
    result = await fetchSwot({ lat, lon });
  } else if (id === "sentinel1") {
    const { data: rain } = await admin
      .from("rain_observations")
      .select("last24h_mm")
      .order("observed_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    result = await fetchSentinel1({ lat, lon, rain24h: rain?.last24h_mm ?? 0 });
  } else {
    result = await fetchSrtm({ lat, lon });
  }

  const up = await admin.from("data_sources").upsert({
    source_id: id,
    last_synced_at: result.synced_at,
    newest_observation_at: result.newest_observation_at,
    payload: result.payload as never,
  });
  if (up.error) throw new Error(`data_sources: ${up.error.message}`);
  return result;
}
