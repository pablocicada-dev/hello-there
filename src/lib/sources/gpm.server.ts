// GPM IMERG (NASA) rain fetcher. Returns the common SourceSyncResult shape.
import type { SourceSyncResult } from "../sources";
import { simRainRate } from "../sim";

export interface RainRow {
  observed_at: string;
  rate_mm_h: number;
  last3h_mm: number;
  last24h_mm: number;
}

const HALF_HOUR = 30 * 60 * 1000;
const LATENCY_MS = 4 * 3.6e6; // IMERG Early Run is about 4 h behind real time

export async function fetchGpmImerg(args: {
  lat: number;
  lon: number;
  lastObservedAt: string | null;
  now?: number;
}): Promise<{ result: SourceSyncResult; rows: RainRow[] }> {
  const now = args.now ?? Date.now();

  // TODO(NASA): replace this mock with the real IMERG call. Steps:
  //  1. Read the token inside the handler: const token = process.env["EARTHDATA_TOKEN"]
  //     (create it at https://urs.earthdata.nasa.gov → Generate Token, then store it as a secret).
  //  2. Request half-hourly IMERG Early Run (GPM_3IMERGHHE, v07) for the pixel at lat/lon, e.g.
  //     GES DISC OPeNDAP:
  //     https://gpm1.gesdisc.eosdis.nasa.gov/opendap/GPM_L3/GPM_3IMERGHHE.07/<YYYY>/<DOY>/
  //       3B-HHR-E.MS.MRG.3IMERG.<YYYYMMDD>-S<HHMMSS>-E<HHMMSS>.<MMMM>.V07B.HDF5.ascii?
  //       precipitation[0][<lonIdx>][<latIdx>]
  //     with header  Authorization: Bearer ${token}
  //  3. Map each half-hour value (mm/h) to RainRow and compute 3 h / 24 h totals.
  const newest = Math.floor((now - LATENCY_MS) / HALF_HOUR) * HALF_HOUR;
  const last = args.lastObservedAt ? Date.parse(args.lastObservedAt) : newest - 48 * HALF_HOUR;
  const start = Math.max(last + HALF_HOUR, newest - 48 * HALF_HOUR);

  const rows: RainRow[] = [];
  for (let t = start; t <= newest; t += HALF_HOUR) {
    let r3 = 0;
    let r24 = 0;
    for (let k = 0; k < 48; k++) {
      const mm = simRainRate(t - k * HALF_HOUR) * 0.5;
      r24 += mm;
      if (k < 6) r3 += mm;
    }
    rows.push({
      observed_at: new Date(t).toISOString(),
      rate_mm_h: Math.round(simRainRate(t) * 100) / 100,
      last3h_mm: Math.round(r3 * 100) / 100,
      last24h_mm: Math.round(r24 * 100) / 100,
    });
  }

  const latest = rows.at(-1);
  return {
    rows,
    result: {
      source_id: "gpm_imerg",
      ok: true,
      mock: true,
      synced_at: new Date(now).toISOString(),
      newest_observation_at: latest?.observed_at ?? args.lastObservedAt,
      observations: rows.length,
      payload: {
        product: "GPM_3IMERGHHE v07 (Early Run)",
        lat: args.lat,
        lon: args.lon,
        rate_mm_h: latest?.rate_mm_h ?? null,
        last3h_mm: latest?.last3h_mm ?? null,
        last24h_mm: latest?.last24h_mm ?? null,
        mock: true,
      },
      message: rows.length ? `${rows.length} new half-hour values (mock)` : "No new values yet",
    },
  };
}
