// SWOT (NASA) river height fetcher. Returns the common SourceSyncResult shape.
import type { SourceSyncResult } from "../sources";
import { tideLevel } from "../sim";

const CYCLE_MS = 21 * 8.64e7;

export async function fetchSwot(args: { lat: number; lon: number; now?: number }): Promise<SourceSyncResult> {
  const now = args.now ?? Date.now();

  // TODO(NASA): replace this mock with the real SWOT call. Steps:
  //  1. const token = process.env["EARTHDATA_TOKEN"]  (read inside the handler).
  //  2. Find the newest granule of SWOT_L2_HR_RiverSP_2.0 over the polder via CMR:
  //     https://cmr.earthdata.nasa.gov/search/granules.json?short_name=SWOT_L2_HR_RiverSP_reach_2.0
  //       &bounding_box=<lon-0.1>,<lat-0.1>,<lon+0.1>,<lat+0.1>&sort_key=-start_date&page_size=1
  //  3. Download the shapefile/zip from PO.DAAC with  Authorization: Bearer ${token}
  //     and read wse (m) and width (m) for the river reach next to the gate.
  const passAt = Math.floor((now - 2 * 8.64e7) / CYCLE_MS) * CYCLE_MS + 6.5 * 3.6e6;
  const wse = Math.round((tideLevel(passAt) + 0.05) * 100) / 100;
  return {
    source_id: "swot",
    ok: true,
    mock: true,
    synced_at: new Date(now).toISOString(),
    newest_observation_at: new Date(passAt).toISOString(),
    observations: 1,
    payload: {
      product: "SWOT L2 HR RiverSP (reach)",
      wse_m: wse,
      width_m: 1180 + Math.round((wse - 1.5) * 60),
      lat: args.lat,
      lon: args.lon,
      mock: true,
    },
    message: "Newest pass loaded (mock)",
  };
}
