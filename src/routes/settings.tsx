import { useEffect, useState, type ChangeEvent, type FormEvent, type ReactNode } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Panel, PageHeader } from "@/components/dg/Card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { useSettings } from "@/hooks/use-deltagate";
import { saveSettings, setSimulator } from "@/lib/gate.functions";
import { DEFAULT_THRESHOLDS, settingsSchema } from "@/lib/settings-schema";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — DeltaGate-IoT" },
      { name: "description", content: "Polder location, gate thresholds and the demo simulator." },
      { property: "og:title", content: "Settings — DeltaGate-IoT" },
      { property: "og:description", content: "Polder location, gate thresholds and the demo simulator." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SettingsPage,
});

type FormState = Record<
  | "area_name"
  | "latitude"
  | "longitude"
  | "danger_level"
  | "drain_start"
  | "drain_stop"
  | "min_head"
  | "salinity_limit"
  | "rain_alert_3h",
  string
>;

const FIELDS: { key: keyof FormState; label: string; unit?: string; step?: string; def?: number; help?: string }[] = [
  { key: "danger_level", label: "Danger level (river)", unit: "m", step: "0.01", def: DEFAULT_THRESHOLDS.danger_level, help: "At or above this, the gate locks closed." },
  { key: "drain_start", label: "Drain start level (polder)", unit: "m", step: "0.01", def: DEFAULT_THRESHOLDS.drain_start, help: "Polder level that starts drainage." },
  { key: "drain_stop", label: "Drain stop level (polder)", unit: "m", step: "0.01", def: DEFAULT_THRESHOLDS.drain_stop, help: "Drainage continues until this level." },
  { key: "min_head", label: "Minimum head", unit: "m", step: "0.01", def: DEFAULT_THRESHOLDS.min_head, help: "Polder must be this much higher than the river." },
  { key: "salinity_limit", label: "Salinity limit (EC)", unit: "dS/m", step: "0.1", def: DEFAULT_THRESHOLDS.salinity_limit, help: "At or above this, river water counts as saline." },
  { key: "rain_alert_3h", label: "Rain alert", unit: "mm in 3 h", step: "1", def: DEFAULT_THRESHOLDS.rain_alert_3h, help: "Lowers drain start by 0.15 m when reached." },
];

function SettingsPage() {
  const { data } = useSettings();
  const save = useServerFn(saveSettings);
  const sim = useServerFn(setSimulator);
  const [f, setF] = useState<FormState | null>(null);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (data && !f) {
      setF({
        area_name: data.area_name,
        latitude: String(data.latitude),
        longitude: String(data.longitude),
        danger_level: String(data.danger_level),
        drain_start: String(data.drain_start),
        drain_stop: String(data.drain_stop),
        min_head: String(data.min_head),
        salinity_limit: String(data.salinity_limit),
        rain_alert_3h: String(data.rain_alert_3h),
      });
    }
  }, [data, f]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!f) return;
    const parsed = settingsSchema.safeParse({
      area_name: f.area_name,
      latitude: Number(f.latitude),
      longitude: Number(f.longitude),
      danger_level: Number(f.danger_level),
      drain_start: Number(f.drain_start),
      drain_stop: Number(f.drain_stop),
      min_head: Number(f.min_head),
      salinity_limit: Number(f.salinity_limit),
      rain_alert_3h: Number(f.rain_alert_3h),
    });
    if (!parsed.success) {
      const errs: Partial<Record<keyof FormState, string>> = {};
      for (const i of parsed.error.issues) {
        const k = i.path[0] as keyof FormState;
        if (!errs[k]) errs[k] = i.message.startsWith("Expected") ? "Enter a number" : i.message;
      }
      setErrors(errs);
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      const r = await save({ data: parsed.data });
      if (r.ok) toast.success(r.message);
      else toast.error(r.message);
    } catch {
      toast.error("Could not save. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const set = (k: keyof FormState) => (e: ChangeEvent<HTMLInputElement>) =>
    setF((s) => (s ? { ...s, [k]: e.target.value } : s));

  return (
    <>
      <PageHeader title="Settings" description="Saved for everyone. Changes apply on the next engine run." />

      {!f || !data ? (
        <Skeleton className="h-96 rounded-xl" />
      ) : (
        <div className="grid gap-4 xl:grid-cols-3">
          <form onSubmit={onSubmit} className="space-y-4 xl:col-span-2" noValidate>
            <Panel title="Location">
              <div className="grid gap-4 sm:grid-cols-3">
                <Field id="area_name" label="Area name" error={errors.area_name} className="sm:col-span-3">
                  <Input id="area_name" value={f.area_name} onChange={set("area_name")} maxLength={120} />
                </Field>
                <Field id="latitude" label="Latitude" unit="°" error={errors.latitude}>
                  <Input id="latitude" type="number" step="0.0001" value={f.latitude} onChange={set("latitude")} />
                </Field>
                <Field id="longitude" label="Longitude" unit="°" error={errors.longitude}>
                  <Input id="longitude" type="number" step="0.0001" value={f.longitude} onChange={set("longitude")} />
                </Field>
              </div>
            </Panel>

            <Panel title="Thresholds" subtitle="Must follow: drain stop < drain start < danger level. Defaults are example values only.">
              <div className="grid gap-4 sm:grid-cols-2">
                {FIELDS.map((fl) => (
                  <Field key={fl.key} id={fl.key} label={fl.label} unit={fl.unit} error={errors[fl.key]} help={`${fl.help} Example: ${fl.def}`}>
                    <Input id={fl.key} type="number" step={fl.step} value={f[fl.key]} onChange={set(fl.key)} />
                  </Field>
                ))}
              </div>
            </Panel>

            <div className="flex justify-end">
              <Button type="submit" disabled={busy}>{busy ? "Saving…" : "Save settings"}</Button>
            </div>
          </form>

          <Panel title="Simulator (demo mode)" subtitle="Makes fake readings every 10 s while the app is open.">
            <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
              <div>
                <Label htmlFor="sim" className="text-sm font-medium">Simulator</Label>
                <p className="text-xs text-muted-foreground">Tides, rain events and salinity rising at high tide.</p>
              </div>
              <Switch
                id="sim"
                checked={data.simulator_enabled}
                onCheckedChange={async (v) => {
                  const r = await sim({ data: { enabled: v } });
                  if (r.ok) toast.success(r.message);
                  else toast.error(r.message);
                }}
              />
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              While on, the top bar shows “Simulated data” and the simulated gate confirms commands. Turn it off when
              the ESP32 is connected.
            </p>
          </Panel>
        </div>
      )}
    </>
  );
}

function Field({
  id,
  label,
  unit,
  error,
  help,
  className,
  children,
}: {
  id: string;
  label: string;
  unit?: string | undefined;
  error?: string | undefined;
  help?: string | undefined;
  className?: string | undefined;
  children: ReactNode;
}) {
  return (
    <div className={className}>
      <Label htmlFor={id} className="mb-1.5 flex items-baseline justify-between gap-2">
        <span>{label}</span>
        {unit && <span className="text-xs font-normal text-muted-foreground">{unit}</span>}
      </Label>
      {children}
      {error ? (
        <p className="mt-1 text-xs font-medium text-danger">{error}</p>
      ) : (
        help && <p className="mt-1 text-xs text-muted-foreground">{help}</p>
      )}
    </div>
  );
}
