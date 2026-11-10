import { describe, expect, it } from "vitest";
import { decide, effectiveDrainStart, interlocks, openBlockedReason, type EngineInput } from "./engine";
import { settingsSchema, DEFAULT_THRESHOLDS } from "./settings-schema";
import { deriveSessions } from "./sessions";

const t = DEFAULT_THRESHOLDS; // danger 3.4, start 2.2, stop 1.9, head 0.10, EC 2.0, rain 25

const base: EngineInput = {
  hOut: 1.5,
  hIn: 2.0,
  ecRiver: 1.0,
  rain3h: 0,
  rain24h: 0,
  sensorAgeMin: 2,
  draining: false,
  estop: false,
  t,
};

describe("decision engine priority", () => {
  it("(a) closes on fail-safe when no sensor data for more than 30 min", () => {
    const d = decide({ ...base, sensorAgeMin: 31, hIn: 2.5 });
    expect(d.mode).toBe("FAIL_SAFE");
    expect(d.targetPct).toBe(0);
    expect(d.forced).toBe(true);
  });

  it("does not fail-safe at exactly 30 min", () => {
    expect(decide({ ...base, sensorAgeMin: 30 }).mode).not.toBe("FAIL_SAFE");
  });

  it("(b) emergency lockdown when river is at the danger level", () => {
    const d = decide({ ...base, hOut: 3.4, hIn: 3.6 });
    expect(d.mode).toBe("EMERGENCY_LOCKDOWN");
    expect(d.targetPct).toBe(0);
    expect(d.forced).toBe(true);
  });

  it("(c) saline lock when river is higher and EC >= limit", () => {
    const d = decide({ ...base, hOut: 2.5, hIn: 2.3, ecRiver: 2.0 });
    expect(d.mode).toBe("SALINE_LOCK");
    expect(d.targetPct).toBe(0);
  });

  it("(d) drains when polder >= drain start and head >= minimum head", () => {
    const d = decide({ ...base, hOut: 2.1, hIn: 2.2 });
    expect(d.mode).toBe("FRESHWATER_DRAINAGE");
    expect(d.targetPct).toBe(100);
    expect(d.draining).toBe(true);
  });

  it("(d) does not drain when head is below minimum", () => {
    const d = decide({ ...base, hOut: 2.15, hIn: 2.2 });
    expect(d.mode).toBe("STANDBY");
    expect(d.targetPct).toBe(0);
  });

  it("rain in last 3 h >= alert lowers drain start by 0.15 m", () => {
    expect(effectiveDrainStart(t, 25)).toBeCloseTo(2.05);
    expect(decide({ ...base, hIn: 2.06, rain3h: 25 }).mode).toBe("FRESHWATER_DRAINAGE");
    expect(decide({ ...base, hIn: 2.06, rain3h: 24 }).mode).toBe("STANDBY");
  });

  it("hysteresis: keeps draining between stop and start, stops at drain stop", () => {
    expect(decide({ ...base, hIn: 2.0, draining: true }).mode).toBe("FRESHWATER_DRAINAGE");
    const stop = decide({ ...base, hIn: 1.9, draining: true });
    expect(stop.mode).toBe("STANDBY");
    expect(stop.draining).toBe(false);
  });

  it("(e) standby otherwise", () => {
    expect(decide(base).mode).toBe("STANDBY");
  });
});

describe("safety interlocks", () => {
  it("blocks opening when river >= danger, sensors silent > 30 min, or e-stop", () => {
    const ok = interlocks({ hOut: 2, sensorAgeMin: 5, estop: false, t });
    expect(openBlockedReason(100, 0, ok)).toBeNull();
    expect(openBlockedReason(100, 0, interlocks({ hOut: 3.4, sensorAgeMin: 5, estop: false, t }))).not.toBeNull();
    expect(openBlockedReason(100, 0, interlocks({ hOut: 2, sensorAgeMin: 31, estop: false, t }))).not.toBeNull();
    expect(openBlockedReason(100, 0, interlocks({ hOut: 2, sensorAgeMin: 5, estop: true, t }))).not.toBeNull();
  });

  it("still allows closing while blocked", () => {
    const locks = interlocks({ hOut: 3.5, sensorAgeMin: 5, estop: true, t });
    expect(openBlockedReason(0, 100, locks)).toBeNull();
  });
});

describe("settings validation", () => {
  const good = { area_name: "Polder", latitude: 22.5, longitude: 89.47, ...t };
  it("accepts drain stop < drain start < danger", () => {
    expect(settingsSchema.safeParse(good).success).toBe(true);
  });
  it("rejects drain stop >= drain start", () => {
    expect(settingsSchema.safeParse({ ...good, drain_stop: 2.2 }).success).toBe(false);
  });
  it("rejects drain start >= danger", () => {
    expect(settingsSchema.safeParse({ ...good, drain_start: 3.4 }).success).toBe(false);
  });
});

describe("open sessions", () => {
  it("pairs opens with closes, newest first", () => {
    const ev = (at: string, pct: number, source = "auto") => ({
      created_at: at, target_pct: pct, source, reason: "", h_in: 2, h_out: 1,
    });
    const s = deriveSessions(
      [ev("2026-01-01T00:00:00Z", 100), ev("2026-01-01T02:00:00Z", 0), ev("2026-01-01T05:00:00Z", 50, "manual")],
      null,
    );
    expect(s).toHaveLength(2);
    expect(s[0]!.source).toBe("manual");
    expect(s[0]!.closedAt).toBeNull();
    expect(s[1]!.closedAt! - s[1]!.openedAt).toBe(2 * 3.6e6);
  });
});
