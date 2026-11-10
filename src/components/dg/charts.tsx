import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipProps,
} from "recharts";
import type { Band, RainPoint, SeriesPoint } from "@/hooks/use-deltagate";
import { fmtDateTime, fmtDay, fmtTime } from "@/lib/format";

const AXIS = { fontSize: 11, fill: "var(--muted-foreground)" };

function tickFmt(span: number) {
  return (v: number) => (span <= 36 * 3.6e6 ? fmtTime(v) : fmtDay(v));
}

interface Row {
  key: string;
  label: string;
  unit: string;
  color: string;
  digits?: number;
}

function makeTooltip(rows: Row[], extra?: (p: Record<string, unknown>) => string | null) {
  return function ChartTip({ active, payload, label }: TooltipProps<number, string>) {
    if (!active || !payload?.length) return null;
    const p = payload[0]?.payload as Record<string, unknown>;
    return (
      <div className="rounded-lg border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md">
        <div className="mb-1 font-medium num">{fmtDateTime(label as number)}</div>
        {rows.map((r) => {
          const v = p[r.key];
          return (
            <div key={r.key} className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <span className="size-2 rounded-full" style={{ background: r.color }} />
                {r.label}
              </span>
              <span className="font-semibold num">
                {typeof v === "number" ? `${v.toFixed(r.digits ?? 2)} ${r.unit}` : "—"}
              </span>
            </div>
          );
        })}
        {extra && extra(p) && <div className="mt-1 text-muted-foreground">{extra(p)}</div>}
      </div>
    );
  };
}

const gateExtra = (p: Record<string, unknown>) =>
  typeof p["gate"] === "number"
    ? p["gate"] > 0
      ? `Gate open ${Math.round(p["gate"])}%`
      : "Gate closed"
    : null;

function Legend({ items }: { items: { label: string; color: string; dashed?: boolean; band?: boolean }[] }) {
  return (
    <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-[0.7rem] text-muted-foreground">
      {items.map((i) => (
        <span key={i.label} className="flex items-center gap-1.5">
          {i.band ? (
            <span className="h-2.5 w-3.5 rounded-sm bg-band ring-1 ring-ok/30" />
          ) : (
            <span
              className="h-0 w-4 border-t-2"
              style={{ borderColor: i.color, borderStyle: i.dashed ? "dashed" : "solid" }}
            />
          )}
          {i.label}
        </span>
      ))}
    </div>
  );
}

interface BaseProps {
  points: SeriesPoint[];
  bands: Band[];
  from: number;
  to: number;
  height?: number;
  syncId?: string;
}

export function LevelChart({ points, bands, from, to, danger, height = 260, syncId }: BaseProps & { danger: number }) {
  const vals = points.flatMap((p) => [p.h_out, p.h_in]).filter((v): v is number => v !== null);
  const lo = vals.length ? Math.min(...vals) : 0;
  const hi = Math.max(danger, vals.length ? Math.max(...vals) : danger);
  const domain: [number, number] = [Math.floor((lo - 0.2) * 2) / 2, Math.ceil((hi + 0.2) * 2) / 2];
  const step = domain[1] - domain[0] > 3 ? 1 : 0.5;
  const ticks: number[] = [];
  for (let v = domain[0]; v <= domain[1] + 1e-9; v += step) ticks.push(Math.round(v * 10) / 10);
  return (
    <div>
      <Legend
        items={[
          { label: "River (H out)", color: "var(--river)" },
          { label: "Polder (H in)", color: "var(--polder)" },
          { label: "Danger level", color: "var(--danger)", dashed: true },
          { label: "Gate open", color: "", band: true },
        ]}
      />
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={points} {...(syncId ? { syncId } : {})} syncMethod="value" margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
          {bands.map((b) => (
            <ReferenceArea key={b.x1} x1={b.x1} x2={b.x2} fill="var(--band)" strokeOpacity={0} ifOverflow="hidden" />
          ))}
          <XAxis
            dataKey="t"
            type="number"
            scale="time"
            domain={[from, to]}
            tickFormatter={tickFmt(to - from)}
            tick={AXIS}
            tickLine={false}
            axisLine={{ stroke: "var(--border)" }}
            minTickGap={32}
          />
          <YAxis domain={domain} ticks={ticks} tick={AXIS} tickLine={false} axisLine={false} width={52} unit=" m" />
          <ReferenceLine
            y={danger}
            stroke="var(--danger)"
            strokeDasharray="6 4"
            label={{ value: `Danger ${danger.toFixed(2)} m`, position: "insideTopRight", fontSize: 10, fill: "var(--danger)" }}
          />
          <Tooltip
            content={makeTooltip(
              [
                { key: "h_out", label: "River", unit: "m", color: "var(--river)" },
                { key: "h_in", label: "Polder", unit: "m", color: "var(--polder)" },
              ],
              gateExtra,
            )}
          />
          <Line type="monotone" dataKey="h_out" stroke="var(--river)" strokeWidth={2} dot={false} isAnimationActive={false} />
          <Line type="monotone" dataKey="h_in" stroke="var(--polder)" strokeWidth={2} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function SalinityChart({ points, bands, from, to, limit, height = 240, syncId }: BaseProps & { limit: number }) {
  return (
    <div>
      <Legend
        items={[
          { label: "River EC", color: "var(--salinity)" },
          { label: "Polder EC", color: "var(--polder)" },
          { label: "Salinity limit", color: "var(--danger)", dashed: true },
          { label: "Gate open", color: "", band: true },
        ]}
      />
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={points} {...(syncId ? { syncId } : {})} syncMethod="value" margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
          {bands.map((b) => (
            <ReferenceArea key={b.x1} x1={b.x1} x2={b.x2} fill="var(--band)" strokeOpacity={0} ifOverflow="hidden" />
          ))}
          <XAxis
            dataKey="t"
            type="number"
            scale="time"
            domain={[from, to]}
            tickFormatter={tickFmt(to - from)}
            tick={AXIS}
            tickLine={false}
            axisLine={{ stroke: "var(--border)" }}
            minTickGap={32}
          />
          <YAxis domain={[0, (max: number) => Math.ceil(Math.max(max, limit) + 0.5)]} tick={AXIS} tickLine={false} axisLine={false} width={52} />
          <ReferenceLine
            y={limit}
            stroke="var(--danger)"
            strokeDasharray="6 4"
            label={{ value: `Limit ${limit.toFixed(1)} dS/m`, position: "insideTopRight", fontSize: 10, fill: "var(--danger)" }}
          />
          <Tooltip
            content={makeTooltip(
              [
                { key: "ec_river", label: "River EC", unit: "dS/m", color: "var(--salinity)" },
                { key: "ec_polder", label: "Polder EC", unit: "dS/m", color: "var(--polder)" },
              ],
              gateExtra,
            )}
          />
          <Line type="monotone" dataKey="ec_river" stroke="var(--salinity)" strokeWidth={2} dot={false} isAnimationActive={false} />
          <Line type="monotone" dataKey="ec_polder" stroke="var(--polder)" strokeWidth={1.5} strokeDasharray="4 3" dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function RainChart({
  rain,
  from,
  to,
  height = 160,
  syncId,
}: {
  rain: RainPoint[];
  from: number;
  to: number;
  height?: number;
  syncId?: string;
}) {
  const barSize = Math.max(1, Math.min(14, Math.floor(640 / Math.max(rain.length, 1)) - 1));
  return (
    <div>
      <Legend items={[{ label: "Rain per interval (GPM IMERG)", color: "var(--rain)" }]} />
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={rain} {...(syncId ? { syncId } : {})} syncMethod="value" margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="t"
            type="number"
            scale="time"
            domain={[from, to]}
            tickFormatter={tickFmt(to - from)}
            tick={AXIS}
            tickLine={false}
            axisLine={{ stroke: "var(--border)" }}
            minTickGap={32}
          />
          <YAxis tick={AXIS} tickLine={false} axisLine={false} width={52} unit=" mm" allowDecimals={false} />
          <Tooltip
            cursor={{ fill: "var(--muted)" }}
            content={makeTooltip([{ key: "rain_mm", label: "Rain", unit: "mm", color: "var(--rain)", digits: 1 }])}
          />
          <Bar dataKey="rain_mm" fill="var(--rain)" barSize={barSize} radius={[2, 2, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
