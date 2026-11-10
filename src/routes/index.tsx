import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Siren } from "lucide-react";
import { Panel, Empty, PageHeader } from "@/components/dg/Card";
import { LevelChart } from "@/components/dg/charts";
import { StatusPill, freshnessTone } from "@/components/dg/StatusPill";
import { Kpi, RuleChecklist, SourceTag, modeLabel, modeTone } from "@/components/dg/widgets";
import {
  useDataSources,
  useGateState,
  useLatestRain,
  useLatestReading,
  useNow,
  useRecentEvents,
  useSeries,
  useThresholds,
} from "@/hooks/use-deltagate";
import { SENSOR_TIMEOUT_MIN } from "@/lib/engine";
import { ageMinutes, fmt, fmtDateTime, formatAge } from "@/lib/format";
import { SOURCES, freshness } from "@/lib/sources";
import {
  gateStatus,
  headStatus,
  polderStatus,
  rainStatus,
  riverStatus,
  salinityStatus,
} from "@/lib/status";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — DeltaGate-IoT" },
      { name: "description", content: "Live river and polder levels, salinity, rain and gate decisions for the polder." },
      { property: "og:title", content: "Dashboard — DeltaGate-IoT" },
      { property: "og:description", content: "Live river and polder levels, salinity, rain and gate decisions." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const now = useNow(15_000);
  const t = useThresholds();
  const { data: r, isLoading } = useLatestReading();
  const { data: rain } = useLatestRain();
  const { data: state } = useGateState();
  const { data: sources } = useDataSources();
  const { data: events } = useRecentEvents(5);
  const { data: series } = useSeries({ key: "24h" });

  const age = now ? ageMinutes(r?.created_at, now) : null;
  const offline = !r || (age !== null && age > SENSOR_TIMEOUT_MIN);
  const rainAge = now ? ageMinutes(rain?.observed_at, now) : null;
  const head = r ? r.h_in - r.h_out : null;

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Live state of the sluice gate and the water on both sides."
        action={
          state && (
            <div className="flex items-center gap-2">
              <StatusPill tone={state.mode === "auto" ? "info" : "warn"}>
                {state.mode === "auto" ? "Auto" : "Manual override"}
              </StatusPill>
              <StatusPill tone={modeTone(state.engine_mode)}>{modeLabel(state.engine_mode)}</StatusPill>
            </div>
          )
        }
      />

      {state?.alert && (
        <div className="mb-4 flex items-start gap-3 rounded-xl border border-danger/40 bg-danger-soft px-4 py-3 text-sm text-danger">
          <Siren className="mt-0.5 size-4 shrink-0" />
          <span className="font-medium">{state.alert}</span>
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <Kpi label="River level (H out)" value={fmt(r?.h_out)} unit="m" status={r ? riverStatus(r.h_out, t) : null} ageMin={age} offline={offline} />
          <Kpi label="Polder level (H in)" value={fmt(r?.h_in)} unit="m" status={r ? polderStatus(r.h_in, t) : null} ageMin={age} offline={offline} />
          <Kpi label="Head (H in − H out)" value={head === null ? "—" : `${head >= 0 ? "+" : ""}${head.toFixed(2)}`} unit="m" status={head !== null ? headStatus(head, t) : null} ageMin={age} offline={offline} />
          <Kpi label="River salinity (EC)" value={fmt(r?.ec_river)} unit="dS/m" status={r ? salinityStatus(r.ec_river, t) : null} ageMin={age} offline={offline} />
          <Kpi
            label="Rain last 24 h"
            value={fmt(rain?.last24h_mm, 1)}
            unit="mm"
            status={rain ? rainStatus(rain.last24h_mm) : null}
            ageMin={rainAge}
            hint="NASA GPM"
          />
          <Kpi label="Gate position" value={r ? `${Math.round(r.gate_pct)}` : "—"} unit="%" status={r ? gateStatus(r.gate_pct) : null} ageMin={age} offline={offline} />
        </div>
      )}

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Panel
          className="xl:col-span-2"
          title="Last 24 hours"
          subtitle="River and polder level. Green bands show when the gate was open."
          action={
            <Link to="/water" className="flex items-center gap-1 text-xs font-medium text-primary hover:underline">
              Water & Salinity <ArrowRight className="size-3" />
            </Link>
          }
        >
          {series ? (
            series.points.length ? (
              <LevelChart points={series.points} bands={series.bands} from={series.from} to={series.to} danger={t.danger_level} height={340} />
            ) : (
              <Empty>No readings in the last 24 hours</Empty>
            )
          ) : (
            <Skeleton className="h-72" />
          )}
        </Panel>

        <Panel
          title="Decision engine"
          subtitle={
            state?.engine_ran_at && now
              ? `Ran ${formatAge(ageMinutes(state.engine_ran_at, now))}`
              : "Rule-based, runs on every new reading"
          }
        >
          {state ? (
            <div className="space-y-4">
              <div className="rounded-lg bg-muted p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="eyebrow">Mode</span>
                  <StatusPill tone={modeTone(state.engine_mode)}>{modeLabel(state.engine_mode)}</StatusPill>
                </div>
                <div className="mt-2 text-base font-semibold text-foreground">
                  Wants gate: {state.engine_target > 0 ? `Open ${Math.round(state.engine_target)}%` : "Closed"}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{state.engine_reason}</p>
                {state.mode === "manual" && (
                  <p className="mt-2 text-xs font-medium text-warn">
                    Manual override: engine only recommends. Fail-safe and lockdown still force a close.
                  </p>
                )}
              </div>
              <RuleChecklist checks={state.checks} />
            </div>
          ) : (
            <Skeleton className="h-72" />
          )}
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel title="Data freshness" subtitle="When each source last synced.">
          <ul className="divide-y">
            {SOURCES.map((s) => {
              const row = sources?.find((x) => x.source_id === s.id);
              const a = now ? ageMinutes(row?.last_synced_at, now) : null;
              const f = freshness(a, s);
              return (
                <li key={s.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-foreground">{s.name}</div>
                    <div className="text-xs text-muted-foreground num">
                      {row?.last_synced_at ? `Synced ${formatAge(a)}` : "Never synced"}
                    </div>
                  </div>
                  {now && <StatusPill tone={freshnessTone(f)}>{f}</StatusPill>}
                </li>
              );
            })}
          </ul>
        </Panel>

        <Panel
          title="Latest gate activity"
          action={
            <Link to="/history" className="flex items-center gap-1 text-xs font-medium text-primary hover:underline">
              History <ArrowRight className="size-3" />
            </Link>
          }
        >
          {events?.length ? (
            <ul className="divide-y">
              {events.map((e) => (
                <li key={e.id} className="flex items-start gap-3 py-2.5 first:pt-0 last:pb-0">
                  <span
                    className={
                      e.target_pct > 0
                        ? "mt-1.5 size-2 shrink-0 rounded-full bg-ok"
                        : "mt-1.5 size-2 shrink-0 rounded-full bg-muted-foreground"
                    }
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-foreground">
                        {e.target_pct > 0 ? `Open ${Math.round(e.target_pct)}%` : "Close"}
                      </span>
                      <SourceTag source={e.source} />
                      {e.is_sample && <span className="text-[0.65rem] text-muted-foreground">sample</span>}
                    </div>
                    <p className="truncate text-xs text-muted-foreground">{e.reason}</p>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground num">{fmtDateTime(e.created_at)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>No gate activity yet</Empty>
          )}
        </Panel>
      </div>
    </>
  );
}
