import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Copy, Info, RefreshCw } from "lucide-react";
import { Panel, PageHeader } from "@/components/dg/Card";
import { StatusPill, freshnessTone } from "@/components/dg/StatusPill";
import { Button } from "@/components/ui/button";
import { useDataSources, useNow } from "@/hooks/use-deltagate";
import { ageMinutes, fmtDateTime, formatAge } from "@/lib/format";
import { SOURCES, freshness, type SourceId } from "@/lib/sources";
import { syncSourceNow } from "@/lib/sources.functions";

export const Route = createFileRoute("/sources")({
  head: () => ({
    meta: [
      { title: "Data Sources — DeltaGate-IoT" },
      { name: "description", content: "ESP32 sensors and NASA satellite sources: sync times, freshness and device API examples." },
      { property: "og:title", content: "Data Sources — DeltaGate-IoT" },
      { property: "og:description", content: "Sensor and satellite data sources with sync status and device API examples." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SourcesPage,
});

function SourcesPage() {
  const now = useNow(15_000);
  const { data: rows } = useDataSources();
  const sync = useServerFn(syncSourceNow);
  const [busy, setBusy] = useState<SourceId | null>(null);
  const [origin, setOrigin] = useState("https://your-app-url");
  useEffect(() => setOrigin(window.location.origin), []);

  async function doSync(id: SourceId) {
    setBusy(id);
    try {
      const r = await sync({ data: { source_id: id } });
      if (r.ok) toast.success(r.message);
      else toast.error(r.message);
    } catch {
      toast.error("Sync failed. Try again.");
    } finally {
      setBusy(null);
    }
  }

  const curlIngest = `curl -X POST ${origin}/api/public/ingest-reading \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: $DEVICE_API_KEY" \\
  -d '{"device_id":"esp32-01","h_out":2.31,"h_in":2.05,"ec_river":1.8,"ec_polder":0.7,"water_temp":27.4,"gate_pct":0}'`;
  const curlPending = `curl "${origin}/api/public/pending-command?device_id=esp32-01" \\
  -H "x-api-key: $DEVICE_API_KEY"`;
  const curlAck = `curl -X POST ${origin}/api/public/ack-command \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: $DEVICE_API_KEY" \\
  -d '{"command_id":123,"device_id":"esp32-01","gate_pct":100}'`;

  return (
    <>
      <PageHeader title="Data Sources" description="Where each number comes from and how fresh it is." />

      <div className="mb-4 flex items-start gap-3 rounded-xl border border-info/30 bg-info-soft px-4 py-3 text-sm text-foreground">
        <Info className="mt-0.5 size-4 shrink-0 text-info" />
        <p>
          NASA data is <strong>not real time</strong>, and satellites <strong>cannot measure salinity</strong>.
          Satellite data is used for rain context, early warning and flood extent. Salinity and the gate trigger
          come only from the local EC sensor.
        </p>
      </div>

      <Panel bodyClassName="p-0 sm:p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="px-5 py-3 font-medium">Source</th>
                <th className="px-3 py-3 font-medium">Provides</th>
                <th className="px-3 py-3 font-medium">Update rhythm</th>
                <th className="px-3 py-3 font-medium">Last synced</th>
                <th className="px-3 py-3 font-medium">Newest observation</th>
                <th className="px-3 py-3 font-medium">Status</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {SOURCES.map((s) => {
                const row = rows?.find((r) => r.source_id === s.id);
                const syncedAge = now ? ageMinutes(row?.last_synced_at, now) : null;
                const obsAge = now ? ageMinutes(row?.newest_observation_at, now) : null;
                const f = freshness(syncedAge, s);
                const mock = (row?.payload as Record<string, unknown> | undefined)?.["mock"];
                return (
                  <tr key={s.id} className="align-top">
                    <td className="px-5 py-3">
                      <div className="font-medium text-foreground">{s.name}</div>
                      {mock ? <div className="text-[0.7rem] text-muted-foreground">Mock data for now</div> : null}
                    </td>
                    <td className="px-3 py-3 text-muted-foreground">{s.provides}</td>
                    <td className="px-3 py-3 text-muted-foreground">{s.rhythm}</td>
                    <td className="px-3 py-3 num">
                      {row?.last_synced_at ? (
                        <>
                          <div className="text-foreground">{formatAge(syncedAge)}</div>
                          <div className="text-xs text-muted-foreground">{fmtDateTime(row.last_synced_at)}</div>
                        </>
                      ) : (
                        <span className="text-muted-foreground">Never</span>
                      )}
                    </td>
                    <td className="px-3 py-3 num">
                      {row?.newest_observation_at ? (
                        <>
                          <div className="text-foreground">{formatAge(obsAge)}</div>
                          <div className="text-xs text-muted-foreground">{fmtDateTime(row.newest_observation_at)}</div>
                        </>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-3 py-3">{now && <StatusPill tone={freshnessTone(f)}>{f}</StatusPill>}</td>
                    <td className="px-5 py-3 text-right">
                      <Button size="sm" variant="outline" onClick={() => doSync(s.id)} disabled={busy !== null}>
                        <RefreshCw className={busy === s.id ? "animate-spin" : undefined} />
                        Sync now
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel
        className="mt-4"
        title="Test the ESP32 API"
        subtitle="Use these calls before the hardware is ready. Put your device key in DEVICE_API_KEY first (it is stored as a server secret)."
      >
        <div className="space-y-4">
          <CodeBlock title="1. Send a reading (runs the decision engine)" code={curlIngest} />
          <CodeBlock title="2. Fetch the newest pending command (204 = nothing to do)" code={curlPending} />
          <CodeBlock title="3. Confirm the command after moving the gate" code={curlAck} />
          <p className="text-xs text-muted-foreground">
            Use the published app address for the real device, so it keeps working when the editor is closed.
          </p>
        </div>
      </Panel>
    </>
  );
}

function CodeBlock({ title, code }: { title: string; code: string }) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-foreground">{title}</span>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            void navigator.clipboard.writeText(code);
            toast.success("Copied");
          }}
        >
          <Copy /> Copy
        </Button>
      </div>
      <pre className="overflow-x-auto rounded-lg bg-muted p-3 font-mono text-xs leading-relaxed text-foreground">{code}</pre>
    </div>
  );
}
