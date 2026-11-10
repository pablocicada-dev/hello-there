// Sentinel-1 flood / open-water extent fetcher. Returns the common SourceSyncResult shape.
import type { SourceSyncResult } from "../sources";

const REPEAT_MS = 6 * 8.64e7;

export async function fetchSentinel1(args: {
  lat: number;
  lon: number;
  rain24h: number;
  now?: number;
}): Promise<SourceSyncResult> {
  const now = args.now ?? Date.now();

  // TODO(NASA/ASF): replace this mock with the real Sentinel-1 call. Steps:
  //  1. const token = process.env["EARTHDATA_TOKEN"]  (Earthdata login also works for ASF).
  //  2. Search the newest GRD scene over the polder:
  //     https://api.daac.asf.alaska.edu/services/search/param?platform=Sentinel-1
  //       &processingLevel=GRD_HD&beamMode=IW&intersectsWith=POINT(<lon> <lat>)&maxResults=1&output=json
  //  3. Classify open water (VV backscatter below about -18 dB) inside the polder outline and
  //     return open_water_km2 and flooded_km2 (water outside normal canals and ponds).
  const sceneAt = Math.floor(now / REPEAT_MS) * REPEAT_MS + 23.9 * 3.6e6 - REPEAT_MS;
  const flooded = Math.round(Math.max(0.4, 1.2 + args.rain24h * 0.08) * 10) / 10;
  return {
    source_id: "sentinel1",
    ok: true,
    mock: true,
    synced_at: new Date(now).toISOString(),
    newest_observation_at: new Date(Math.min(sceneAt, now - 3.6e6)).toISOString(),
    observations: 1,
    payload: {
      product: "Sentinel-1 GRD IW (VV)",
      open_water_km2: Math.round((37 + flooded) * 10) / 10,
      flooded_km2: flooded,
      lat: args.lat,
      lon: args.lon,
      mock: true,
    },
    message: "Newest scene loaded (mock)",
  };
}
