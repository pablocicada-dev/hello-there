import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Panel, Empty, PageHeader } from "@/components/dg/Card";
import { LevelChart, RainChart, SalinityChart } from "@/components/dg/charts";
import { RangeSelector } from "@/components/dg/RangeSelector";
import { Kpi } from "@/components/dg/widgets";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useLatestRain,
  useLatestReading,
  useNow,
  useSeries,
  useThresholds,
  type RangeSpec,
} from "@/hooks/use-deltagate";
import { SENSOR_TIMEOUT_MIN } from "@/lib/engine";
import { ageMinutes, fmt } from "@/lib/format";
import { polderStatus, riverStatus, salinityStatus } from "@/lib/status";

export const Route = createFileRoute("/water")({
  head: () => ({
    meta: [
      { title: "Water & Salinity — DeltaGate-IoT" },
      { name: "description", content: "River and polder water level, salinity (EC) and rainfall on one time axis." },
      { property: "og:title", content: "Water & Salinity — DeltaGate-IoT" },
      { property: "og:description", content: "River and polder water level, salinity and rainfall on one time axis." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: WaterPage,
});

function WaterPage() {
  const now = useNow(10_000);
  const t = useThresholds();
  const [range, setRange] = useState<RangeSpec>({ key: "24h" });
  const { data: r, isLoading } = useLatestReading();
  const { data: rain } = useLatestRain();
  const { data: series, isFetching } = useSeries(range);

  const age = now ? ageMinutes(r?.created_at, now) : null;
  const offline = !r || (age !== null && age > SENSOR_TIMEOUT_MIN);
  const hasTemp = r?.water_temp !== null && r?.water_temp !== undefined;

  return (
    <>
      <PageHeader
        title="Water & Salinity"
        description="Live readings from the gate sensors. Charts update on their own."
      />

      {isLoading ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-36 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <Kpi big label="River water level" value={fmt(r?.h_out)} unit="m" status={r ? riverStatus(r.h_out, t) : null} ageMin={age} offline={offline} />
          <Kpi big label="Polder water level" value={fmt(r?.h_in)} unit="m" status={r ? polderStatus(r.h_in, t) : null} ageMin={age} offline={offline} />
          <Kpi big label="River salinity (EC)" value={fmt(r?.ec_river)} unit="dS/m" status={r ? salinityStatus(r.ec_river, t) : null} ageMin={age} offline={offline} />
          <Kpi
            big
            label="Polder salinity (EC)"
            value={fmt(r?.ec_polder)}
            unit="dS/m"
            status={r?.ec_polder != null ? salinityStatus(r.ec_polder, t) : null}
            ageMin={age}
            offline={offline || r?.ec_polder == null}
          />
          {hasTemp ? (
            <Kpi big label="Water temperature" value={fmt(r?.water_temp, 1)} unit="°C" ageMin={age} offline={offline} />
          ) : (
            <Kpi big label="Water temperature" value="—" ageMin={age} hint="No sensor" />
          )}
        </div>
      )}

      <div className="mt-6 mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-muted-foreground">
          Hover any chart to see exact values. All three share one time axis.
          {isFetching && <span className="ml-2 text-xs">Updating…</span>}
        </div>
        <RangeSelector value={range} onChange={setRange} />
      </div>

      <div className="grid gap-4">
        <Panel title="River level vs polder level" subtitle="Dashed red line: danger level. Green bands: gate open.">
          {series ? (
            series.points.length ? (
              <LevelChart syncId="water" points={series.points} bands={series.bands} from={series.from} to={series.to} danger={t.danger_level} />
            ) : (
              <Empty>No readings in this range</Empty>
            )
          ) : (
            <Skeleton className="h-64" />
          )}
        </Panel>
        <Panel title="River salinity (EC)" subtitle="Polder EC shown dashed. Red line: salinity limit.">
          {series ? (
            series.points.length ? (
              <SalinityChart syncId="water" points={series.points} bands={series.bands} from={series.from} to={series.to} limit={t.salinity_limit} />
            ) : (
              <Empty>No readings in this range</Empty>
            )
          ) : (
            <Skeleton className="h-60" />
          )}
        </Panel>
        <Panel
          title="Rainfall"
          subtitle={`From NASA GPM IMERG, about 4 h behind real time.${rain ? ` Last 3 h: ${rain.last3h_mm.toFixed(1)} mm, last 24 h: ${rain.last24h_mm.toFixed(1)} mm.` : ""}`}
        >
          {series ? (
            series.rain.length ? (
              <RainChart syncId="water" rain={series.rain} from={series.from} to={series.to} />
            ) : (
              <Empty>No rain data in this range</Empty>
            )
          ) : (
            <Skeleton className="h-40" />
          )}
        </Panel>
      </div>
    </>
  );
}
