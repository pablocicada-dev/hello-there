// Simulator physics shared by the live simulator and the mock GPM fetcher. Pure functions.

const TWO_PI = Math.PI * 2;

/** River level (m) from a semi-diurnal tide with spring/neap and diurnal inequality. */
export function tideLevel(ms: number): number {
  const hrs = ms / 3.6e6;
  const days = ms / 8.64e7;
  const amp = 0.85 + 0.25 * Math.cos((TWO_PI * days) / 14.77);
  return 1.55 + amp * Math.sin((TWO_PI * hrs) / 12.42) + 0.12 * Math.sin((TWO_PI * hrs) / 24.84 + 1);
}

function hash(n: number): number {
  const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

/** Deterministic rain rate (mm/h): roughly 1 in 8 six-hour blocks has a shower. */
export function simRainRate(ms: number): number {
  const block = Math.floor(ms / (6 * 3.6e6));
  const h = hash(block);
  if (h > 0.125) return 0;
  const intensity = 3 + 16 * hash(block + 0.5);
  const phase = (ms % (6 * 3.6e6)) / (6 * 3.6e6);
  return Math.max(0, intensity * Math.sin(Math.PI * phase));
}

export interface SimState {
  createdAtMs: number;
  h_in: number;
  ec_polder: number | null;
}

export interface SimReading {
  h_out: number;
  h_in: number;
  ec_river: number;
  ec_polder: number;
  water_temp: number;
  gate_pct: number;
}

const r3 = (n: number) => Math.round(n * 1000) / 1000;

export function nextSimReading(
  prev: SimState | null,
  nowMs: number,
  gatePct: number,
  rain24h: number,
  rand: () => number = Math.random,
): SimReading {
  const hOut = tideLevel(nowMs) + (rand() - 0.5) * 0.02;
  const dtH = prev ? Math.min(0.5, Math.max(0, (nowMs - prev.createdAtMs) / 3.6e6)) : 0;
  const prevIn = prev?.h_in ?? 2.0;
  const head = prevIn - hOut;
  const rate = simRainRate(nowMs);
  const drain = gatePct > 0 && head > 0 ? 0.08 * (gatePct / 100) * Math.sqrt(head) : 0;
  const hIn = prevIn + (0.004 + 0.005 * rate - drain) * dtH + (rand() - 0.5) * 0.003;
  const ec =
    1.8 +
    1.4 * Math.max(0, (hOut - 0.45) / 2.2) -
    Math.min(0.8, 0.02 * rain24h) +
    (rand() - 0.5) * 0.06;
  const ecp = Math.min(1.3, Math.max(0.4, (prev?.ec_polder ?? 0.7) + (rand() - 0.5) * 0.01));
  const hrs = nowMs / 3.6e6;
  const temp = 26.5 + 1.5 * Math.sin((TWO_PI * (hrs - 9)) / 24) + (rand() - 0.5) * 0.1;
  return {
    h_out: r3(hOut),
    h_in: r3(hIn),
    ec_river: r3(Math.max(0.3, ec)),
    ec_polder: r3(ecp),
    water_temp: Math.round(temp * 100) / 100,
    gate_pct: gatePct,
  };
}
