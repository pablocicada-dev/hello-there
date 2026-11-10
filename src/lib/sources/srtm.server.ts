// SRTM / NASADEM terrain fetcher. Loaded once. Returns the common SourceSyncResult shape.
import type { SourceSyncResult } from "../sources";

export async function fetchSrtm(args: { lat: number; lon: number; now?: number }): Promise<SourceSyncResult> {
  const now = args.now ?? Date.now();

  // TODO(NASA): replace this mock with the real NASADEM call. Steps:
  //  1. const token = process.env["EARTHDATA_TOKEN"]
  //  2. Download the 1°x1° tile NASADEM_HGT_n<lat>e<lon>.zip from LP DAAC:
  //     https://e4ftl01.cr.usgs.gov/MEASURES/NASADEM_HGT.001/2000.02.11/NASADEM_HGT_n22e089.zip
  //     with  Authorization: Bearer ${token}
  //  3. Sample heights inside the polder outline and store mean/min/max (m) once.
  return {
    source_id: "srtm",
    ok: true,
    mock: true,
    synced_at: new Date(now).toISOString(),
    newest_observation_at: "2000-02-22T00:00:00.000Z",
    observations: 1,
    payload: {
      product: "NASADEM 1 arc-second",
      mean_elev_m: 1.6,
      min_elev_m: 0.4,
      max_elev_m: 3.9,
      polder_area_km2: 64.5,
      lat: args.lat,
      lon: args.lon,
      mock: true,
    },
    message: "Terrain loaded (mock)",
  };
}
