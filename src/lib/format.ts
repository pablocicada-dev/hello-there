export function ageMinutes(iso: string | null | undefined, now: number): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return Math.max(0, (now - t) / 60000);
}

export function formatAge(min: number | null): string {
  if (min === null) return "never";
  if (min < 1) return "just now";
  if (min < 60) return `${Math.round(min)} min ago`;
  const h = Math.floor(min / 60);
  if (h < 48) {
    const m = Math.round(min - h * 60);
    return m > 0 && h < 6 ? `${h} h ${m} min ago` : `${h} h ago`;
  }
  return `${Math.round(h / 24)} d ago`;
}

export function formatDuration(ms: number): string {
  const min = Math.round(ms / 60000);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h < 24) return m ? `${h} h ${m} min` : `${h} h`;
  const d = Math.floor(h / 24);
  return `${d} d ${h % 24} h`;
}

export function fmt(n: number | null | undefined, digits = 2): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return n.toFixed(digits);
}

const dtf = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});
const tf = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
const df = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short" });

export const fmtDateTime = (v: string | number | Date) => dtf.format(new Date(v));
export const fmtTime = (v: string | number | Date) => tf.format(new Date(v));
export const fmtDay = (v: string | number | Date) => df.format(new Date(v));
