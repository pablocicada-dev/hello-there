import { NEAR_DANGER_MARGIN_M, type Thresholds } from "./engine";

export type Tone = "ok" | "warn" | "danger" | "info" | "neutral" | "offline";
export interface Status {
  label: string;
  tone: Tone;
}

export function riverStatus(h: number, t: Thresholds): Status {
  if (h >= t.danger_level) return { label: "Danger", tone: "danger" };
  if (h >= t.danger_level - NEAR_DANGER_MARGIN_M) return { label: "Near danger", tone: "warn" };
  return { label: "Normal", tone: "ok" };
}

/** Polder: near danger once drainage is needed, danger 0.4 m above drain start (waterlogging). */
export function polderStatus(h: number, t: Thresholds): Status {
  if (h >= t.drain_start + 0.4) return { label: "Danger", tone: "danger" };
  if (h >= t.drain_start) return { label: "Near danger", tone: "warn" };
  return { label: "Normal", tone: "ok" };
}

export function salinityStatus(ec: number, t: Thresholds): Status {
  return ec >= t.salinity_limit ? { label: "Saline", tone: "danger" } : { label: "Fresh", tone: "ok" };
}

export function rainStatus(mm24: number): Status {
  if (mm24 < 1) return { label: "Dry", tone: "neutral" };
  if (mm24 < 20) return { label: "Light rain", tone: "info" };
  return { label: "Heavy rain", tone: "warn" };
}

export function headStatus(head: number, t: Thresholds): Status {
  if (head >= t.min_head) return { label: "Can drain", tone: "ok" };
  if (head < 0) return { label: "River higher", tone: "neutral" };
  return { label: "Too small", tone: "neutral" };
}

export function gateStatus(pct: number): Status {
  if (pct <= 0.5) return { label: "Closed", tone: "neutral" };
  if (pct >= 99.5) return { label: "Open", tone: "info" };
  return { label: "Partly open", tone: "info" };
}
