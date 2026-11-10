import type { ReactNode } from "react";
import { Ban, CheckCircle2, CircleDashed, TriangleAlert, WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { AgeBadge } from "./Card";
import { StatusPill, type PillTone } from "./StatusPill";
import type { RuleCheck, EngineMode } from "@/lib/engine";
import { MODE_LABEL } from "@/lib/engine";
import type { Status } from "@/lib/status";

export function Kpi({
  label,
  value,
  unit,
  status,
  ageMin,
  offline,
  hint,
  big,
}: {
  label: string;
  value: string;
  unit?: string;
  status?: Status | null;
  ageMin: number | null;
  offline?: boolean;
  hint?: ReactNode;
  big?: boolean;
}) {
  return (
    <div className={cn("panel flex min-w-0 flex-col gap-2 p-4", offline && "border-danger/40")}>
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {offline ? (
        <div className="flex items-center gap-2 py-1 text-danger">
          <WifiOff className="size-5" />
          <span className={cn("font-semibold", big ? "text-2xl" : "text-xl")}>No signal</span>
        </div>
      ) : (
        <div className="flex items-baseline gap-1">
          <span className={cn("font-semibold text-foreground num", big ? "text-4xl" : "text-[1.7rem] leading-tight")}>
            {value}
          </span>
          {unit && <span className="text-sm text-muted-foreground">{unit}</span>}
        </div>
      )}
      <div className="mt-auto flex flex-wrap items-center gap-x-2 gap-y-1">
        {offline ? (
          <StatusPill tone="offline">No signal</StatusPill>
        ) : (
          status && <StatusPill tone={status.tone as PillTone}>{status.label}</StatusPill>
        )}
        <AgeBadge ageMin={ageMin} className={offline ? "text-danger" : undefined} />
        {hint && <span className="ml-auto text-[0.7rem] text-muted-foreground">{hint}</span>}
      </div>
    </div>
  );
}

const CHECK_ICON = {
  ok: <CheckCircle2 className="size-4 text-ok" />,
  warn: <TriangleAlert className="size-4 text-warn" />,
  block: <Ban className="size-4 text-danger" />,
  idle: <CircleDashed className="size-4 text-muted-foreground" />,
};
const CHECK_PILL: Record<RuleCheck["state"], { tone: PillTone; label: string }> = {
  ok: { tone: "ok", label: "OK" },
  warn: { tone: "warn", label: "Warning" },
  block: { tone: "danger", label: "Blocked" },
  idle: { tone: "neutral", label: "Not met" },
};

export function RuleChecklist({ checks }: { checks: RuleCheck[] }) {
  return (
    <ul className="divide-y">
      {checks.map((c) => (
        <li key={c.id} className="flex items-start gap-3 py-2.5 first:pt-0 last:pb-0">
          <span className="mt-0.5">{CHECK_ICON[c.state]}</span>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium text-foreground">{c.label}</div>
            <div className="text-xs text-muted-foreground num">{c.detail}</div>
          </div>
          <StatusPill tone={CHECK_PILL[c.state].tone} dot={false}>
            {CHECK_PILL[c.state].label}
          </StatusPill>
        </li>
      ))}
    </ul>
  );
}

export function modeTone(mode: string): PillTone {
  switch (mode as EngineMode) {
    case "FAIL_SAFE":
    case "EMERGENCY_LOCKDOWN":
      return "danger";
    case "SALINE_LOCK":
      return "warn";
    case "FRESHWATER_DRAINAGE":
      return "info";
    default:
      return "neutral";
  }
}

export function modeLabel(mode: string) {
  return MODE_LABEL[mode as EngineMode] ?? mode;
}

export function SourceTag({ source }: { source: string }) {
  const tone: PillTone = source === "auto" ? "info" : source === "manual" ? "warn" : "danger";
  const label = source === "auto" ? "Auto" : source === "manual" ? "Manual" : "Interlock";
  return (
    <StatusPill tone={tone} dot={false}>
      {label}
    </StatusPill>
  );
}

export function SampleNote({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <StatusPill tone="warn" dot={false}>
      Includes sample data
    </StatusPill>
  );
}
