import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  Activity,
  ChevronsLeft,
  ChevronsRight,
  Database,
  Droplets,
  History,
  LayoutDashboard,
  Menu,
  Moon,
  Settings,
  SlidersVertical,
  Sun,
} from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { useTheme } from "@/hooks/use-theme";
import {
  useDataSources,
  useLatestReading,
  useNow,
  useRealtimeSync,
  useSettings,
} from "@/hooks/use-deltagate";
import { ageMinutes, formatAge } from "@/lib/format";
import { SOURCE_BY_ID, freshness } from "@/lib/sources";
import { tick } from "@/lib/gate.functions";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/water", label: "Water & Salinity", icon: Droplets },
  { to: "/gate", label: "Gate Control", icon: SlidersVertical },
  { to: "/sources", label: "Data Sources", icon: Database },
  { to: "/history", label: "History", icon: History },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

function NavList({ collapsed, onNavigate }: { collapsed?: boolean; onNavigate?: () => void }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav className="flex flex-col gap-0.5 p-2">
      {NAV.map(({ to, label, icon: Icon }) => {
        const active = to === "/" ? path === "/" : path.startsWith(to);
        return (
          <Link
            key={to}
            to={to}
            onClick={onNavigate}
            title={collapsed ? label : undefined}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground hover:bg-muted",
              collapsed && "justify-center px-0",
            )}
          >
            <Icon className="size-4 shrink-0" />
            {!collapsed && <span className="truncate">{label}</span>}
          </Link>
        );
      })}
    </nav>
  );
}

function FreshDot({ tone }: { tone: "Fresh" | "Late" | "Overdue" }) {
  return (
    <span
      className={cn(
        "size-2 rounded-full",
        tone === "Fresh" ? "bg-ok live-dot" : tone === "Late" ? "bg-warn" : "bg-danger",
      )}
    />
  );
}

/** Keeps the simulator and the fail-safe heartbeat running while a tab is open. */
function useTickLoop() {
  const run = useServerFn(tick);
  const busy = useRef(false);
  useEffect(() => {
    const go = async () => {
      if (busy.current || document.hidden) return;
      busy.current = true;
      try {
        await run();
      } catch (e) {
        console.warn("tick failed", e);
      } finally {
        busy.current = false;
      }
    };
    void go();
    const id = setInterval(go, 10_000);
    return () => clearInterval(id);
  }, [run]);
}

export function AppShell({ children }: { children: ReactNode }) {
  useRealtimeSync();
  useTickLoop();
  const now = useNow(10_000);
  const { theme, toggle } = useTheme();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { data: settings } = useSettings();
  const { data: latest } = useLatestReading();
  const { data: sources } = useDataSources();

  const sensorAge = now ? ageMinutes(latest?.created_at, now) : null;
  const gpm = sources?.find((s) => s.source_id === "gpm_imerg");
  const rainAge = now ? ageMinutes(gpm?.last_synced_at, now) : null;
  const sim = settings?.simulator_enabled;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-topbar-border bg-topbar px-3 text-topbar-foreground sm:px-4">
        <button
          className="rounded-md p-1.5 hover:bg-topbar-border md:hidden"
          onClick={() => setMobileOpen(true)}
          aria-label="Open menu"
        >
          <Menu className="size-5" />
        </button>
        <Link to="/" className="flex items-center gap-2.5">
          <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground">
            <Activity className="size-4" />
          </span>
          <span className="leading-tight">
            <span className="block text-sm font-semibold tracking-tight">DeltaGate-IoT</span>
            <span className="hidden text-[0.7rem] text-topbar-muted sm:block">
              {settings?.area_name ?? "Sluice gate monitoring"}
            </span>
          </span>
        </Link>

        <div className="ml-auto flex items-center gap-2 sm:gap-4">
          {sim && (
            <span className="rounded-full border border-warn/40 bg-warn-soft px-2 py-0.5 text-[0.7rem] font-semibold text-warn">
              Simulated data
            </span>
          )}
          <div className="hidden items-center gap-4 text-xs text-topbar-muted lg:flex">
            <span className="flex items-center gap-1.5 num">
              <FreshDot tone={freshness(sensorAge, SOURCE_BY_ID.esp32)} />
              Sensors {now ? formatAge(sensorAge) : "…"}
            </span>
            <span className="flex items-center gap-1.5 num">
              <FreshDot tone={freshness(rainAge, SOURCE_BY_ID.gpm_imerg)} />
              NASA rain {now ? formatAge(rainAge) : "…"}
            </span>
          </div>
          <button
            onClick={toggle}
            className="rounded-md p-1.5 text-topbar-muted hover:bg-topbar-border hover:text-topbar-foreground"
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          >
            {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </button>
        </div>
      </header>

      {/* Compact freshness line for small screens */}
      <div className="flex items-center justify-center gap-4 border-b bg-card px-3 py-1.5 text-[0.7rem] text-muted-foreground lg:hidden num">
        <span className="flex items-center gap-1.5">
          <FreshDot tone={freshness(sensorAge, SOURCE_BY_ID.esp32)} />
          Sensors {now ? formatAge(sensorAge) : "…"}
        </span>
        <span className="flex items-center gap-1.5">
          <FreshDot tone={freshness(rainAge, SOURCE_BY_ID.gpm_imerg)} />
          NASA rain {now ? formatAge(rainAge) : "…"}
        </span>
      </div>

      <div className="flex">
        <aside
          className={cn(
            "sticky top-14 hidden h-[calc(100svh-3.5rem)] shrink-0 flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-200 md:flex",
            collapsed ? "w-16" : "w-60",
          )}
        >
          <NavList collapsed={collapsed} />
          <div className="mt-auto p-2">
            {!collapsed && (
              <p className="mb-2 px-3 text-[0.68rem] leading-relaxed text-muted-foreground">
                Advice and automation within safe limits. The real gate also needs hardware limit
                switches, an emergency stop and a safety interlock.
              </p>
            )}
            <button
              onClick={() => setCollapsed((c) => !c)}
              className="flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs text-muted-foreground hover:bg-muted"
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {collapsed ? <ChevronsRight className="size-4" /> : <><ChevronsLeft className="size-4" /> Collapse</>}
            </button>
          </div>
        </aside>

        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent side="left" className="w-64 bg-sidebar p-0">
            <SheetTitle className="px-5 pt-5 text-sm">DeltaGate-IoT</SheetTitle>
            <NavList onNavigate={() => setMobileOpen(false)} />
          </SheetContent>
        </Sheet>

        <main className="min-w-0 flex-1 px-3 py-5 sm:px-6 sm:py-6 lg:px-8">
          <div className="mx-auto max-w-[1400px]">{children}</div>
        </main>
      </div>
    </div>
  );
}
