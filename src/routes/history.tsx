import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Panel, Empty, PageHeader } from "@/components/dg/Card";
import { LevelChart, SalinityChart } from "@/components/dg/charts";
import { RangeSelector } from "@/components/dg/RangeSelector";
import { SampleNote, SourceTag } from "@/components/dg/widgets";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useEventsBetween,
  useNow,
  useSeries,
  useThresholds,
  type RangeSpec,
} from "@/hooks/use-deltagate";
import { fmt, fmtDateTime, formatDuration } from "@/lib/format";
import { deriveSessions, summarize } from "@/lib/sessions";

export const Route = createFileRoute("/history")({
  head: () => ({
    meta: [
      { title: "History — DeltaGate-IoT" },
      { name: "description", content: "Gate open sessions, who opened the gate and why, with water level and salinity history." },
      { property: "og:title", content: "History — DeltaGate-IoT" },
      { property: "og:description", content: "Gate open sessions with water level and salinity history." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: HistoryPage,
});

function HistoryPage() {
  const now = useNow(60_000);
  const t = useThresholds();
  const [range, setRange] = useState<RangeSpec>({ key: "7d" });
  const { data: series } = useSeries(range);
  const span = range.key === "24h" ? 864e5 : range.key === "7d" ? 7 * 864e5 : 30 * 864e5;
  const to = series?.to ?? now ?? 0;
  const from = series?.from ?? to - span;
  const { data: ev } = useEventsBetween(from, to, `${range.key}-${Math.floor(to / 60000)}`);

  const sessions = useMemo(() => (ev ? deriveSessions(ev.events, ev.before) : []), [ev]);
  const sum = summarize(sessions, from, to);
  const maxIn = series?.points.reduce((m, p) => Math.max(m, p.max_h_in ?? -Infinity), -Infinity);
  const maxOut = series?.points.reduce((m, p) => Math.max(m, p.max_h_out ?? -Infinity), -Infinity);
  const hasSample = !!ev?.events.some((e) => e.is_sample);

  return (
    <>
      <PageHeader
        title="History"
        description="What the gate did, when, and why."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <SampleNote show={hasSample} />
            <RangeSelector value={range} onChange={setRange} allowCustom={false} />
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <Tile label="Open sessions" value={ev ? String(sum.count) : "—"} />
        <Tile label="Total time open" value={ev ? formatDuration(sum.totalMs) : "—"} />
        <Tile label="Opened by" value={ev ? `${sum.auto} auto · ${sum.manual} manual` : "—"} small />
        <Tile label="Highest polder level" value={maxIn !== undefined && Number.isFinite(maxIn) ? `${fmt(maxIn)} m` : "—"} />
        <Tile label="Highest river level" value={maxOut !== undefined && Number.isFinite(maxOut) ? `${fmt(maxOut)} m` : "—"} />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Panel title="Water level" subtitle="Green bands: gate open.">
          {series ? (
            series.points.length ? (
              <LevelChart syncId="hist" points={series.points} bands={series.bands} from={series.from} to={series.to} danger={t.danger_level} />
            ) : (
              <Empty>No readings</Empty>
            )
          ) : (
            <Skeleton className="h-64" />
          )}
        </Panel>
        <Panel title="Salinity (EC)" subtitle="Green bands: gate open.">
          {series ? (
            series.points.length ? (
              <SalinityChart syncId="hist" points={series.points} bands={series.bands} from={series.from} to={series.to} limit={t.salinity_limit} height={260} />
            ) : (
              <Empty>No readings</Empty>
            )
          ) : (
            <Skeleton className="h-64" />
          )}
        </Panel>
      </div>

      <Panel className="mt-4" title="Gate open sessions" subtitle="Newest first." bodyClassName="p-0 sm:p-0">
        {!ev ? (
          <div className="p-5"><Skeleton className="h-40" /></div>
        ) : sessions.length === 0 ? (
          <div className="p-5"><Empty>No open sessions in this range</Empty></div>
        ) : (
          <div className="max-h-[520px] overflow-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="sticky top-0 bg-card">
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="px-5 py-3 font-medium">Opened at</th>
                  <th className="px-3 py-3 font-medium">Closed at</th>
                  <th className="px-3 py-3 font-medium">Open for</th>
                  <th className="px-3 py-3 font-medium">Opening</th>
                  <th className="px-3 py-3 font-medium">Opened by</th>
                  <th className="px-3 py-3 font-medium">Reason</th>
                  <th className="px-3 py-3 text-right font-medium">H in</th>
                  <th className="px-5 py-3 text-right font-medium">H out</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {sessions.map((s) => (
                  <tr key={s.openedAt}>
                    <td className="px-5 py-2.5 whitespace-nowrap num">{fmtDateTime(s.openedAt)}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap num">
                      {s.closedAt ? fmtDateTime(s.closedAt) : <span className="font-medium text-ok">Still open</span>}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap num">
                      {formatDuration((s.closedAt ?? now ?? s.openedAt) - s.openedAt)}
                    </td>
                    <td className="px-3 py-2.5 num">{Math.round(s.pct)}%</td>
                    <td className="px-3 py-2.5"><SourceTag source={s.source} /></td>
                    <td className="max-w-[320px] px-3 py-2.5 text-muted-foreground">{s.reason}</td>
                    <td className="px-3 py-2.5 text-right num">{fmt(s.h_in)} m</td>
                    <td className="px-5 py-2.5 text-right num">{fmt(s.h_out)} m</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
      {hasSample && (
        <p className="mt-3 text-xs text-muted-foreground">
          Sample data: the first 30 days are generated example history so the page is not empty. New
          readings from the simulator or the ESP32 are added on top.
        </p>
      )}
    </>
  );
}

function Tile({ label, value, small }: { label: string; value: string; small?: boolean }) {
  return (
    <div className="panel p-4">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className={small ? "mt-1.5 text-lg font-semibold text-foreground num" : "mt-1 text-2xl font-semibold text-foreground num"}>
        {value}
      </div>
    </div>
  );
}
