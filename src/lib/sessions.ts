// Turns gate events into open sessions (opened → closed). Pure, used by History.

export interface EventLike {
  created_at: string;
  target_pct: number;
  source: string;
  reason: string;
  h_in: number | null;
  h_out: number | null;
}

export interface Session {
  openedAt: number;
  closedAt: number | null;
  pct: number;
  source: string;
  reason: string;
  h_in: number | null;
  h_out: number | null;
}

/** events must be sorted oldest first. `before` is the newest event before the range. */
export function deriveSessions(events: EventLike[], before: EventLike | null): Session[] {
  const out: Session[] = [];
  let cur: Session | null = null;
  const start = (e: EventLike): Session => ({
    openedAt: Date.parse(e.created_at),
    closedAt: null,
    pct: e.target_pct,
    source: e.source,
    reason: e.reason,
    h_in: e.h_in,
    h_out: e.h_out,
  });
  if (before && before.target_pct > 0) cur = start(before);
  for (const e of events) {
    if (e.target_pct > 0) {
      if (!cur) cur = start(e);
      else cur.pct = Math.max(cur.pct, e.target_pct);
    } else if (cur) {
      cur.closedAt = Date.parse(e.created_at);
      out.push(cur);
      cur = null;
    }
  }
  if (cur) out.push(cur);
  return out.reverse();
}

export function summarize(sessions: Session[], from: number, to: number) {
  let totalMs = 0;
  let auto = 0;
  let manual = 0;
  for (const s of sessions) {
    const a = Math.max(s.openedAt, from);
    const b = Math.min(s.closedAt ?? to, to);
    if (b > a) totalMs += b - a;
    if (s.source === "manual") manual++;
    else auto++;
  }
  return { count: sessions.length, totalMs, auto, manual };
}
