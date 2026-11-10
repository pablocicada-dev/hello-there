// Rule-based gate decision engine. Pure and browser-safe so the server, the UI and the tests
// all use the same rules. This is advice plus automation inside safe limits: a real gate
// must also have physical limit switches, an emergency stop and a hardware safety interlock.

export interface Thresholds {
  danger_level: number;
  drain_start: number;
  drain_stop: number;
  min_head: number;
  salinity_limit: number;
  rain_alert_3h: number;
}

export type EngineMode =
  | "FAIL_SAFE"
  | "EMERGENCY_LOCKDOWN"
  | "SALINE_LOCK"
  | "FRESHWATER_DRAINAGE"
  | "STANDBY";

export type CheckState = "ok" | "warn" | "block" | "idle";

export interface RuleCheck {
  id: string;
  label: string;
  state: CheckState;
  detail: string;
}

export interface EngineInput {
  hOut: number | null;
  hIn: number | null;
  ecRiver: number | null;
  rain3h: number | null;
  rain24h: number | null;
  /** Minutes since the newest sensor reading; null when there has never been one. */
  sensorAgeMin: number | null;
  /** Hysteresis memory: true while a drainage cycle is in progress. */
  draining: boolean;
  estop: boolean;
  t: Thresholds;
}

export interface EngineDecision {
  mode: EngineMode;
  targetPct: number;
  reason: string;
  alert: string | null;
  draining: boolean;
  /** True for rules (a) and (b): they force a close even in Manual mode. */
  forced: boolean;
  checks: RuleCheck[];
}

export const SENSOR_TIMEOUT_MIN = 30;
export const SENSOR_LATE_MIN = 10;
export const RAIN_DRAIN_OFFSET_M = 0.15;
export const NEAR_DANGER_MARGIN_M = 0.3;

export const MODE_LABEL: Record<EngineMode, string> = {
  FAIL_SAFE: "Fail-safe",
  EMERGENCY_LOCKDOWN: "Emergency lockdown",
  SALINE_LOCK: "Saline lock",
  FRESHWATER_DRAINAGE: "Freshwater drainage",
  STANDBY: "Standby",
};

const f2 = (n: number) => n.toFixed(2);

export function effectiveDrainStart(t: Thresholds, rain3h: number | null): number {
  return (rain3h ?? 0) >= t.rain_alert_3h ? t.drain_start - RAIN_DRAIN_OFFSET_M : t.drain_start;
}

export function sensorsDown(ageMin: number | null): boolean {
  return ageMin === null || ageMin > SENSOR_TIMEOUT_MIN;
}

export function decide(input: EngineInput): EngineDecision {
  const { hOut, hIn, ecRiver, rain3h, sensorAgeMin, t } = input;
  const down = sensorsDown(sensorAgeMin) || hOut === null || hIn === null;
  const startEff = effectiveDrainStart(t, rain3h);
  const head = hOut !== null && hIn !== null ? hIn - hOut : null;
  const riverHigher = hOut !== null && hIn !== null && hOut > hIn;
  const saline = ecRiver === null ? riverHigher : ecRiver >= t.salinity_limit;
  const wantsDrain =
    hIn !== null && (hIn >= startEff || (input.draining && hIn > t.drain_stop));

  const checks: RuleCheck[] = [];

  // Sensors
  checks.push({
    id: "sensors",
    label: "Sensors reporting",
    state: down ? "block" : (sensorAgeMin ?? 0) > SENSOR_LATE_MIN ? "warn" : "ok",
    detail:
      sensorAgeMin === null
        ? "No reading yet"
        : `Last reading ${Math.round(sensorAgeMin)} min ago (limit ${SENSOR_TIMEOUT_MIN} min)`,
  });

  // River vs danger
  checks.push({
    id: "river",
    label: "River below danger level",
    state:
      hOut === null
        ? "block"
        : hOut >= t.danger_level
          ? "block"
          : hOut >= t.danger_level - NEAR_DANGER_MARGIN_M
            ? "warn"
            : "ok",
    detail: hOut === null ? "No river level" : `${f2(hOut)} m vs danger ${f2(t.danger_level)} m`,
  });

  // Salinity
  checks.push({
    id: "salinity",
    label: "No salty water entering",
    state: riverHigher && saline ? "block" : saline ? "warn" : "ok",
    detail:
      ecRiver === null
        ? "No EC reading"
        : riverHigher && saline
          ? `River EC ${f2(ecRiver)} dS/m ≥ ${f2(t.salinity_limit)} and river is higher`
          : saline
            ? `River EC ${f2(ecRiver)} dS/m is saline, but river is lower`
            : `River EC ${f2(ecRiver)} dS/m < ${f2(t.salinity_limit)}`,
  });

  // Drainage need
  checks.push({
    id: "drain",
    label: "Polder needs draining",
    state: wantsDrain ? "ok" : "idle",
    detail:
      hIn === null
        ? "No polder level"
        : input.draining && hIn > t.drain_stop && hIn < startEff
          ? `Draining until ${f2(t.drain_stop)} m (now ${f2(hIn)} m)`
          : `${f2(hIn)} m vs start ${f2(startEff)} m`,
  });

  // Head
  checks.push({
    id: "head",
    label: "Head high enough to drain",
    state: head === null ? "block" : head >= t.min_head ? "ok" : wantsDrain ? "block" : "idle",
    detail: head === null ? "No levels" : `${f2(head)} m vs minimum ${f2(t.min_head)} m`,
  });

  // Rain
  checks.push({
    id: "rain",
    label: "Rain last 3 h below alert",
    state: (rain3h ?? 0) >= t.rain_alert_3h ? "warn" : "ok",
    detail:
      rain3h === null
        ? "No rain data"
        : (rain3h ?? 0) >= t.rain_alert_3h
          ? `${rain3h.toFixed(1)} mm ≥ ${t.rain_alert_3h} mm: drain start lowered 0.15 m`
          : `${rain3h.toFixed(1)} mm < ${t.rain_alert_3h} mm`,
  });

  checks.push({
    id: "estop",
    label: "Emergency stop released",
    state: input.estop ? "block" : "ok",
    detail: input.estop ? "Emergency stop is pressed" : "Released",
  });

  // (a) FAIL-SAFE
  if (down) {
    return {
      mode: "FAIL_SAFE",
      targetPct: 0,
      reason:
        sensorAgeMin === null
          ? "Fail-safe: no sensor data, gate closed"
          : `Fail-safe: no sensor data for ${Math.round(sensorAgeMin)} min, gate closed`,
      alert: "Sensors not reporting. Gate held closed.",
      draining: input.draining,
      forced: true,
      checks,
    };
  }
  // From here hOut and hIn are known.
  const ho = hOut as number;
  const hi = hIn as number;
  const hd = hi - ho;

  // (b) EMERGENCY LOCKDOWN
  if (ho >= t.danger_level) {
    return {
      mode: "EMERGENCY_LOCKDOWN",
      targetPct: 0,
      reason: `Emergency lockdown: river ${f2(ho)} m ≥ danger ${f2(t.danger_level)} m`,
      alert: `River at ${f2(ho)} m, at or above danger level. Gate locked closed.`,
      draining: input.draining,
      forced: true,
      checks,
    };
  }

  // (c) SALINE LOCK
  if (riverHigher && saline) {
    return {
      mode: "SALINE_LOCK",
      targetPct: 0,
      reason:
        ecRiver === null
          ? "Saline lock: river higher than polder and EC unknown"
          : `Saline lock: river EC ${f2(ecRiver)} dS/m ≥ ${f2(t.salinity_limit)}, river higher than polder`,
      alert: null,
      draining: hi <= t.drain_stop ? false : input.draining,
      forced: false,
      checks,
    };
  }

  // (d) FRESHWATER DRAINAGE (with hysteresis)
  if (wantsDrain && hd >= t.min_head) {
    return {
      mode: "FRESHWATER_DRAINAGE",
      targetPct: 100,
      reason: `Freshwater drainage: polder ${f2(hi)} m, head ${f2(hd)} m`,
      alert: null,
      draining: true,
      forced: false,
      checks,
    };
  }

  // (e) STANDBY
  let reason = "Standby: polder below drain start";
  let draining = input.draining;
  if (input.draining && hi <= t.drain_stop) {
    draining = false;
    reason = `Drain stop reached: polder ${f2(hi)} m ≤ ${f2(t.drain_stop)} m`;
  } else if (wantsDrain) {
    reason = `Standby: head ${f2(hd)} m too small, waiting for low tide`;
  }
  return { mode: "STANDBY", targetPct: 0, reason, alert: null, draining, forced: false, checks };
}

export interface Interlock {
  id: "river" | "sensors" | "estop";
  label: string;
  blocked: boolean;
  detail: string;
}

/** Safety interlocks: they win over both Auto and Manual. Any blocked item blocks opening. */
export function interlocks(args: {
  hOut: number | null;
  sensorAgeMin: number | null;
  estop: boolean;
  t: Thresholds;
}): Interlock[] {
  const down = sensorsDown(args.sensorAgeMin);
  return [
    {
      id: "river",
      label: "River below danger level",
      blocked: args.hOut === null || args.hOut >= args.t.danger_level,
      detail:
        args.hOut === null
          ? "No river level"
          : `${f2(args.hOut)} m vs ${f2(args.t.danger_level)} m`,
    },
    {
      id: "sensors",
      label: "Sensors reporting",
      blocked: down,
      detail:
        args.sensorAgeMin === null
          ? "No reading yet"
          : `Last reading ${Math.round(args.sensorAgeMin)} min ago`,
    },
    {
      id: "estop",
      label: "Emergency stop released",
      blocked: args.estop,
      detail: args.estop ? "Pressed" : "Released",
    },
  ];
}

/** Opening (increasing the gate %) is blocked while any interlock is active. */
export function openBlockedReason(
  targetPct: number,
  currentPct: number,
  locks: Interlock[],
): string | null {
  if (targetPct <= currentPct) return null;
  const hit = locks.find((l) => l.blocked);
  return hit ? `Open blocked: ${hit.label.toLowerCase()} — ${hit.detail}` : null;
}
