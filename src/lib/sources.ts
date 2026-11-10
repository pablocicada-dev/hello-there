// Browser-safe metadata for each data source. Fetchers live in src/lib/sources/*.server.ts.

export type SourceId = "esp32" | "gpm_imerg" | "swot" | "sentinel1" | "srtm";

export interface SourceMeta {
  id: SourceId;
  name: string;
  short: string;
  provides: string;
  rhythm: string;
  /** Minutes since last sync that still count as Fresh / Late. Beyond late = Overdue. */
  freshMin: number;
  lateMin: number;
  syncable: boolean;
}

export const SOURCES: SourceMeta[] = [
  {
    id: "esp32",
    name: "ESP32 sensors",
    short: "Sensors",
    provides: "H out, H in, EC river/polder, water temp, gate position",
    rhythm: "Live, every few minutes",
    freshMin: 10,
    lateMin: 30,
    syncable: true,
  },
  {
    id: "gpm_imerg",
    name: "GPM IMERG (NASA)",
    short: "NASA rain",
    provides: "Rain rate, 3 h and 24 h totals",
    rhythm: "Every 30 min, about 4 h latency",
    freshMin: 60,
    lateMin: 180,
    syncable: true,
  },
  {
    id: "swot",
    name: "SWOT (NASA)",
    short: "SWOT",
    provides: "River surface height and width",
    rhythm: "A pass about every 21 days",
    freshMin: 60 * 24 * 7,
    lateMin: 60 * 24 * 21,
    syncable: true,
  },
  {
    id: "sentinel1",
    name: "Sentinel-1 (ESA / ASF)",
    short: "Sentinel-1",
    provides: "Flood and open-water extent",
    rhythm: "A scene every 6 to 12 days",
    freshMin: 60 * 24 * 3,
    lateMin: 60 * 24 * 12,
    syncable: true,
  },
  {
    id: "srtm",
    name: "SRTM / NASADEM",
    short: "Terrain",
    provides: "Terrain height of the polder",
    rhythm: "Loaded once",
    freshMin: Number.POSITIVE_INFINITY,
    lateMin: Number.POSITIVE_INFINITY,
    syncable: true,
  },
];

export const SOURCE_BY_ID = Object.fromEntries(SOURCES.map((s) => [s.id, s])) as Record<
  SourceId,
  SourceMeta
>;

export type Freshness = "Fresh" | "Late" | "Overdue";

export function freshness(ageMin: number | null, meta: SourceMeta): Freshness {
  if (ageMin === null) return "Overdue";
  if (ageMin <= meta.freshMin) return "Fresh";
  if (ageMin <= meta.lateMin) return "Late";
  return "Overdue";
}

/** Common return shape for every source fetcher. */
export interface SourceSyncResult {
  source_id: SourceId;
  ok: boolean;
  mock: boolean;
  synced_at: string;
  newest_observation_at: string | null;
  observations: number;
  payload: Record<string, unknown>;
  message: string;
}
