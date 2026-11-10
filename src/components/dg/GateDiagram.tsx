// Side view of the sluice: river on the left, polder on the right, a gate leaf that rises with %.
import { cn } from "@/lib/utils";

const W = 640;
const H = 320;
const BASE = 292; // y of the channel bed (0 m)
const TOP_M = 4.5;
const PX = (BASE - 28) / TOP_M;
const y = (m: number) => BASE - Math.max(-0.2, Math.min(TOP_M, m)) * PX;

export function GateDiagram({
  hOut,
  hIn,
  gatePct,
  danger,
  offline,
  className,
}: {
  hOut: number | null;
  hIn: number | null;
  gatePct: number;
  danger: number;
  offline?: boolean;
  className?: string;
}) {
  const gx = 300;
  const gw = 40;
  const leafH = 4.0 * PX;
  const lift = (Math.max(0, Math.min(100, gatePct)) / 100) * 2.4 * PX;
  const flowing = !offline && gatePct > 0 && hOut !== null && hIn !== null && Math.abs(hIn - hOut) > 0.02;
  const draining = flowing && (hIn ?? 0) > (hOut ?? 0);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={cn("h-auto w-full", className)} role="img"
      aria-label={`Gate ${Math.round(gatePct)}% open. River ${hOut?.toFixed(2) ?? "unknown"} m, polder ${hIn?.toFixed(2) ?? "unknown"} m.`}>
      <defs>
        <linearGradient id="riverW" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="var(--river)" stopOpacity="0.55" />
          <stop offset="1" stopColor="var(--river)" stopOpacity="0.25" />
        </linearGradient>
        <linearGradient id="polderW" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="var(--polder)" stopOpacity="0.55" />
          <stop offset="1" stopColor="var(--polder)" stopOpacity="0.22" />
        </linearGradient>
        <clipPath id="leafClip">
          <rect x={0} y={y(4.3) + 8} width={W} height={H} />
        </clipPath>
        <pattern id="soil" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="8" stroke="var(--border)" strokeWidth="3" />
        </pattern>
      </defs>

      {/* scale */}
      {[0, 1, 2, 3, 4].map((m) => (
        <g key={m}>
          <line x1={28} x2={W - 8} y1={y(m)} y2={y(m)} stroke="var(--border)" strokeDasharray="2 4" />
          <text x={4} y={y(m) + 4} fontSize="10" fill="var(--muted-foreground)">{m} m</text>
        </g>
      ))}

      {/* water */}
      {!offline && hOut !== null && (
        <rect x={28} y={y(hOut)} width={gx - 28} height={BASE - y(hOut)} fill="url(#riverW)"
          style={{ transition: "y 1s ease, height 1s ease" }} />
      )}
      {!offline && hIn !== null && (
        <rect x={gx + gw} y={y(hIn)} width={W - 8 - gx - gw} height={BASE - y(hIn)} fill="url(#polderW)"
          style={{ transition: "y 1s ease, height 1s ease" }} />
      )}

      {/* bed */}
      <rect x={28} y={BASE} width={W - 36} height={H - BASE} fill="url(#soil)" />
      <line x1={28} x2={W - 8} y1={BASE} y2={BASE} stroke="var(--gate)" strokeWidth="1.5" />

      {/* gate frame */}
      <rect x={gx - 6} y={y(4.3)} width={gw + 12} height={8} rx={2} fill="var(--gate)" />
      <rect x={gx - 6} y={y(4.3)} width={5} height={BASE - y(4.3)} fill="var(--gate)" opacity="0.5" />
      <rect x={gx + gw + 1} y={y(4.3)} width={5} height={BASE - y(4.3)} fill="var(--gate)" opacity="0.5" />

      {/* leaf */}
      <g clipPath="url(#leafClip)">
      <g style={{ transform: `translateY(${-lift}px)`, transition: "transform 1.2s ease" }}>
        <rect x={gx} y={BASE - leafH} width={gw} height={leafH} rx={2} fill="var(--card)" stroke="var(--gate)" strokeWidth="2" />
        {[1, 2, 3].map((k) => (
          <line key={k} x1={gx + 4} x2={gx + gw - 4} y1={BASE - (leafH * k) / 4} y2={BASE - (leafH * k) / 4} stroke="var(--gate)" strokeOpacity="0.4" />
        ))}
      </g>
      </g>

      {/* flow arrow */}
      {flowing && (
        <g fill="none" stroke={draining ? "var(--polder)" : "var(--danger)"} strokeWidth="3" strokeLinecap="round">
          {draining ? (
            <path d={`M ${gx + gw + 60} ${BASE - 14} L ${gx - 60} ${BASE - 14} m 12 -8 l -12 8 l 12 8`} />
          ) : (
            <path d={`M ${gx - 60} ${BASE - 14} L ${gx + gw + 60} ${BASE - 14} m -12 -8 l 12 8 l -12 8`} />
          )}
        </g>
      )}

      {/* danger */}
      <line x1={28} x2={W - 8} y1={y(danger)} y2={y(danger)} stroke="var(--danger)" strokeWidth="1.5" strokeDasharray="7 5" />
      <text x={W - 10} y={y(danger) - 5} textAnchor="end" fontSize="11" fontWeight="600" fill="var(--danger)">
        Danger {danger.toFixed(2)} m
      </text>

      {/* labels */}
      <text x={40} y={26} fontSize="12" fontWeight="600" fill="var(--foreground)">River (H out)</text>
      <text x={40} y={44} fontSize="18" fontWeight="600" fill="var(--river)" className="num">
        {offline || hOut === null ? "No signal" : `${hOut.toFixed(2)} m`}
      </text>
      <text x={W - 20} y={26} textAnchor="end" fontSize="12" fontWeight="600" fill="var(--foreground)">Polder (H in)</text>
      <text x={W - 20} y={44} textAnchor="end" fontSize="18" fontWeight="600" fill="var(--polder)" className="num">
        {offline || hIn === null ? "No signal" : `${hIn.toFixed(2)} m`}
      </text>
      <text x={gx + gw / 2} y={y(4.3) - 8} textAnchor="middle" fontSize="12" fontWeight="600" fill="var(--foreground)">
        Gate {Math.round(gatePct)}%
      </text>
    </svg>
  );
}
