import type { ReactNode } from "react";
import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatAge } from "@/lib/format";

export function Panel({
  title,
  subtitle,
  action,
  children,
  className,
  bodyClassName,
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cn("panel min-w-0", className)}>
      {(title || action) && (
        <header className="flex flex-wrap items-start justify-between gap-2 px-4 pt-4 sm:px-5">
          <div className="min-w-0">
            {title && <h2 className="text-sm font-semibold text-foreground">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
          </div>
          {action}
        </header>
      )}
      <div className={cn("p-4 sm:p-5", title || action ? "pt-3 sm:pt-3" : "", bodyClassName)}>
        {children}
      </div>
    </section>
  );
}

export function AgeBadge({ ageMin, className }: { ageMin: number | null; className?: string | undefined }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-[0.7rem] text-muted-foreground num",
        className,
      )}
    >
      <Clock className="size-3" aria-hidden />
      {ageMin === null ? "—" : formatAge(ageMin)}
    </span>
  );
}

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-24 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
      {children}
    </div>
  );
}
