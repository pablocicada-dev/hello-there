import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Ban, CheckCircle2, CirclePause, CircleStop, Cpu, Lock, LockOpen, RotateCcw } from "lucide-react";
import { Panel, PageHeader, Empty } from "@/components/dg/Card";
import { GateDiagram } from "@/components/dg/GateDiagram";
import { StatusPill } from "@/components/dg/StatusPill";
import { SourceTag, modeLabel, modeTone } from "@/components/dg/widgets";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  useCommands,
  useGateState,
  useHardwareDevice,
  useLatestReading,
  useNow,
  useThresholds,
} from "@/hooks/use-deltagate";
import { SENSOR_TIMEOUT_MIN, interlocks } from "@/lib/engine";
import { ageMinutes, fmtDateTime, formatAge } from "@/lib/format";
import {
  emergencyStop,
  resetEmergencyStop,
  returnToAuto,
  sendManualCommand,
} from "@/lib/gate.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/gate")({
  head: () => ({
    meta: [
      { title: "Gate Control — DeltaGate-IoT" },
      { name: "description", content: "Operate the sluice gate: auto or manual mode, opening, safety interlocks and command log." },
      { property: "og:title", content: "Gate Control — DeltaGate-IoT" },
      { property: "og:description", content: "Operate the sluice gate with safety interlocks and a command log." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: GatePage,
});

const STATUS_TONE = { pending: "warn", sent: "info", acknowledged: "ok", superseded: "neutral" } as const;

function GatePage() {
  const now = useNow(10_000);
  const t = useThresholds();
  const { data: r } = useLatestReading();
  const { data: state } = useGateState();
  const { data: commands } = useCommands(12);
  const device = useHardwareDevice();

  const send = useServerFn(sendManualCommand);
  const toAuto = useServerFn(returnToAuto);
  const estop = useServerFn(emergencyStop);
  const reset = useServerFn(resetEmergencyStop);
  const [busy, setBusy] = useState(false);
  const [pct, setPct] = useState(50);

  useEffect(() => {
    if (r) setPct(Math.round(r.gate_pct));
    // only seed once when the first reading arrives
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [r?.id === undefined]);

  const age = now ? ageMinutes(r?.created_at, now) : null;
  const offline = !r || (age !== null && age > SENSOR_TIMEOUT_MIN);
  const pos = r?.gate_pct ?? 0;
  const locks = interlocks({ hOut: r?.h_out ?? null, sensorAgeMin: now ? age : 0, estop: !!state?.estop, t });
  const openLocked = now !== null && locks.some((l) => l.blocked);
  const hwFresh = device && now && (ageMinutes(device.created_at, now) ?? 99) < SENSOR_TIMEOUT_MIN;

  async function run(label: string, fn: () => Promise<{ ok: boolean; message: string }>) {
    setBusy(true);
    try {
      const res = await fn();
      if (res.ok) toast.success(res.message);
      else toast.error(res.message);
    } catch (e) {
      console.error(e);
      toast.error(`${label} failed. Try again.`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Gate Control"
        description="Safety interlocks always win over Auto and Manual."
        action={
          <span className="flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs text-muted-foreground">
            <Cpu className="size-3.5" />
            {hwFresh ? `Hardware: ESP32 ${device?.device_id}` : "Hardware: simulated gate"}
          </span>
        }
      />

      <div className="grid gap-4 xl:grid-cols-5">
        <Panel
          className="xl:col-span-3"
          title="Gate side view"
          subtitle={r && now ? `Last reading ${formatAge(age)}` : undefined}
          action={state && <StatusPill tone={modeTone(state.engine_mode)}>{modeLabel(state.engine_mode)}</StatusPill>}
        >
          {r ? (
            <GateDiagram hOut={r.h_out} hIn={r.h_in} gatePct={pos} danger={t.danger_level} offline={offline} />
          ) : (
            <Skeleton className="aspect-[2/1]" />
          )}
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Mini label="Position" value={`${Math.round(pos)}%`} />
            <Mini label="Commanded" value={state ? `${Math.round(state.target_pct)}%` : "—"} />
            <LimitSwitch label="Closed limit" on={pos <= 0.5} />
            <LimitSwitch label="Open limit" on={pos >= 99.5} />
          </div>
        </Panel>

        <div className="space-y-4 xl:col-span-2">
          <Panel title="Mode">
            {state ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
                  <ModeTab active={state.mode === "auto"} label="Auto" onClick={() => state.mode !== "auto" && run("Return to Auto", () => toAuto())} disabled={busy} />
                  <ModeTab active={state.mode === "manual"} label="Manual" onClick={() => state.mode !== "manual" && run("Hold", () => send({ data: { action: "hold" } }))} disabled={busy} />
                </div>
                <p className="text-xs text-muted-foreground">
                  {state.mode === "auto"
                    ? "The decision engine controls the gate. Any manual command switches to Manual override."
                    : "Manual override: the engine only recommends. Fail-safe and emergency lockdown still force a close."}
                </p>
                {state.mode === "manual" && (
                  <Button className="w-full" onClick={() => run("Return to Auto", () => toAuto())} disabled={busy}>
                    <RotateCcw /> Return to Auto
                  </Button>
                )}
              </div>
            ) : (
              <Skeleton className="h-24" />
            )}
          </Panel>

          <Panel title="Commands">
            <div className="grid grid-cols-3 gap-2">
              <Button onClick={() => run("Open", () => send({ data: { action: "open" } }))} disabled={busy || openLocked || !!state?.estop}>
                <LockOpen /> Open 100%
              </Button>
              <Button variant="outline" onClick={() => run("Close", () => send({ data: { action: "close" } }))} disabled={busy}>
                <Lock /> Close
              </Button>
              <Button variant="outline" onClick={() => run("Hold", () => send({ data: { action: "hold" } }))} disabled={busy}>
                <CirclePause /> Hold
              </Button>
            </div>
            <div className="mt-4 rounded-lg border p-3">
              <div className="mb-3 flex items-center justify-between text-sm">
                <span className="font-medium text-foreground">Opening</span>
                <span className="font-semibold num">{pct}%</span>
              </div>
              <Slider value={[pct]} min={0} max={100} step={5} onValueChange={(v) => setPct(v[0] ?? 0)} aria-label="Opening percent" />
              <Button
                variant="secondary"
                className="mt-3 w-full"
                onClick={() => run("Apply", () => send({ data: { action: "set", pct } }))}
                disabled={busy || (pct > pos && openLocked)}
              >
                Apply {pct}%
              </Button>
            </div>
            {openLocked && (
              <p className="mt-3 text-xs font-medium text-danger">Opening is blocked by a safety interlock.</p>
            )}

            <div className="mt-4">
              {state?.estop ? (
                <Button variant="outline" className="w-full border-danger text-danger" onClick={() => run("Reset", () => reset())} disabled={busy}>
                  <RotateCcw /> Reset emergency stop
                </Button>
              ) : (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" className="h-11 w-full text-base" disabled={busy}>
                      <CircleStop className="size-5" /> Emergency stop
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Press emergency stop?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Gate motion stops where it is. Opening is blocked and Auto pauses until you reset.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => run("Emergency stop", () => estop())}>Stop now</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          </Panel>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Panel title="Engine recommendation">
          {state ? (
            <div className="space-y-2">
              <StatusPill tone={modeTone(state.engine_mode)}>{modeLabel(state.engine_mode)}</StatusPill>
              <div className="text-lg font-semibold text-foreground">
                {state.engine_target > 0 ? `Open ${Math.round(state.engine_target)}%` : "Keep closed"}
              </div>
              <p className="text-sm text-muted-foreground">{state.engine_reason}</p>
              {state.mode === "manual" && Math.round(state.engine_target) !== Math.round(state.target_pct) && (
                <p className="text-xs font-medium text-warn">Differs from the manual setting ({Math.round(state.target_pct)}%).</p>
              )}
            </div>
          ) : (
            <Skeleton className="h-24" />
          )}
        </Panel>

        <Panel title="Safety interlocks" subtitle="Any blocked item stops opening.">
          <ul className="divide-y">
            {locks.map((l) => (
              <li key={l.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                {l.blocked && now ? <Ban className="size-4 text-danger" /> : <CheckCircle2 className="size-4 text-ok" />}
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-foreground">{l.label}</div>
                  <div className="text-xs text-muted-foreground num">{l.detail}</div>
                </div>
                <StatusPill tone={l.blocked && now ? "danger" : "ok"} dot={false}>
                  {l.blocked && now ? "Blocked" : "Allowed"}
                </StatusPill>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title="Command log" subtitle="pending → sent → acknowledged" bodyClassName="px-0 sm:px-0">
          {commands?.length ? (
            <ul className="max-h-80 divide-y overflow-auto">
              {commands.map((c) => (
                <li key={c.id} className="flex items-center gap-2 px-4 py-2 sm:px-5">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold num">{Math.round(c.target_pct)}%</span>
                      <SourceTag source={c.source} />
                    </div>
                    <div className="truncate text-[0.7rem] text-muted-foreground num">
                      {fmtDateTime(c.created_at)} · {c.reason}
                    </div>
                  </div>
                  <StatusPill tone={STATUS_TONE[c.status as keyof typeof STATUS_TONE] ?? "neutral"} dot={false}>
                    {c.status}
                  </StatusPill>
                </li>
              ))}
            </ul>
          ) : (
            <div className="px-4 sm:px-5"><Empty>No commands yet</Empty></div>
          )}
        </Panel>
      </div>

      <p className="mt-6 text-xs text-muted-foreground">
        This system gives advice and automation within safe limits. A real gate must also have physical
        limit switches, an emergency stop and a safety interlock in hardware.
      </p>
    </>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted px-3 py-2">
      <div className="text-[0.7rem] text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold text-foreground num">{value}</div>
    </div>
  );
}

function LimitSwitch({ label, on }: { label: string; on: boolean }) {
  return (
    <div className="rounded-lg bg-muted px-3 py-2">
      <div className="text-[0.7rem] text-muted-foreground">{label}</div>
      <div className="flex items-center gap-1.5 text-sm font-semibold">
        <span className={cn("size-2.5 rounded-full", on ? "bg-ok" : "bg-border")} />
        <span className={on ? "text-ok" : "text-muted-foreground"}>{on ? "Active" : "Off"}</span>
      </div>
    </div>
  );
}

function ModeTab({ active, label, onClick, disabled }: { active: boolean; label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "rounded-md py-1.5 text-sm font-medium transition-colors disabled:opacity-60",
        active ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
    </button>
  );
}
