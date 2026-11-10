import { cva, type VariantProps } from "class-variance-authority";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const pill = cva(
  "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-[0.7rem] font-semibold leading-5",
  {
    variants: {
      tone: {
        ok: "bg-ok-soft text-ok",
        warn: "bg-warn-soft text-warn",
        danger: "bg-danger-soft text-danger",
        info: "bg-info-soft text-info",
        neutral: "bg-neutral-soft text-muted-foreground",
        offline: "bg-danger text-destructive-foreground",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export type PillTone = NonNullable<VariantProps<typeof pill>["tone"]>;

export function StatusPill({
  tone,
  children,
  dot = true,
  className,
}: {
  tone: PillTone;
  children: ReactNode;
  dot?: boolean;
  className?: string;
}) {
  return (
    <span className={cn(pill({ tone }), className)}>
      {dot && <span className="size-1.5 rounded-full bg-current" aria-hidden />}
      {children}
    </span>
  );
}

export function freshnessTone(f: "Fresh" | "Late" | "Overdue"): PillTone {
  return f === "Fresh" ? "ok" : f === "Late" ? "warn" : "danger";
}
