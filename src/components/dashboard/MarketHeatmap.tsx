import { useMemo } from "react";
import { cn } from "@/lib/utils";
import type { MarketQuote } from "@/services/market/marketData";
import { Activity, ArrowDownRight, ArrowUpRight } from "lucide-react";

interface Props {
  quotes: MarketQuote[];
  ar?: boolean;
  className?: string;
}

// Map change% to color intensity (0..1) on a piecewise scale calibrated for daily moves.
function intensity(changePct: number): number {
  const abs = Math.min(Math.abs(changePct), 6);
  return Math.max(0.12, abs / 6);
}

// AI conviction score derived deterministically from momentum + volatility alignment.
// We don't make a new AI call here — we surface what the existing engine already knows.
function conviction(q: MarketQuote): { score: number; tier: "A" | "B" | "C"; tierColor: string } {
  const dirAlign = q.changePct >= 0 ? q.momentum : -q.momentum; // momentum agrees with move?
  const norm = (dirAlign + 100) / 200; // 0..1
  const volPenalty = Math.min(q.volatility, 80) / 200; // penalize extreme vol
  const score = Math.max(0, Math.min(1, norm - volPenalty));
  const tier = score >= 0.7 ? "A" : score >= 0.45 ? "B" : "C";
  const tierColor = tier === "A" ? "text-success" : tier === "B" ? "text-amber-400" : "text-muted-foreground";
  return { score, tier, tierColor };
}

function MiniSpark({ history, up }: { history: number[]; up: boolean }) {
  if (!history?.length) return null;
  const min = Math.min(...history);
  const max = Math.max(...history);
  const range = max - min || 1;
  const w = 64, h = 22;
  const step = w / (history.length - 1 || 1);
  const pts = history.map((v, i) => `${(i * step).toFixed(2)},${(h - ((v - min) / range) * h).toFixed(2)}`);
  const d = `M${pts.join(" L")}`;
  const fillD = `${d} L${w},${h} L0,${h} Z`;
  return (
    <svg width={w} height={h} className={cn("opacity-90", up ? "text-success" : "text-danger")}>
      <path d={fillD} fill="currentColor" fillOpacity="0.14" />
      <path d={d} fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function HeatTile({ q, ar }: { q: MarketQuote; ar?: boolean }) {
  const up = q.changePct >= 0;
  const i = intensity(q.changePct);
  const conv = conviction(q);

  // Custom CSS bg using color-mix for graceful dark-mode-aware shading.
  const bg = up
    ? `color-mix(in oklab, hsl(var(--success) / 1) ${Math.round(i * 38)}%, hsl(var(--card)))`
    : `color-mix(in oklab, hsl(var(--danger) / 1) ${Math.round(i * 38)}%, hsl(var(--card)))`;

  return (
    <div
      className={cn(
        "group relative flex flex-col gap-2 rounded-xl border border-border/40 p-3 transition-all hover:scale-[1.015] hover:border-border/80",
        "backdrop-blur-sm",
      )}
      style={{ background: bg }}
    >
      {/* Header: symbol + AI tier */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-baseline gap-1.5">
            <span className="text-sm font-bold tracking-wide text-foreground">{q.key}</span>
            <span className="truncate text-[10px] uppercase text-muted-foreground">{q.name}</span>
          </div>
          <div className="mt-0.5 font-mono text-xs tabular-nums text-foreground/90" dir="ltr">
            ${q.price >= 1000 ? q.price.toLocaleString(undefined, { maximumFractionDigits: 2 }) : q.price.toFixed(q.price >= 10 ? 2 : 4)}
          </div>
        </div>
        <div className="flex flex-col items-end gap-0.5">
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-md border border-border/40 bg-background/60 px-1.5 py-0.5 text-[10px] font-bold",
              conv.tierColor,
            )}
            title={ar ? "قناعة الذكاء الاصطناعي" : "AI conviction"}
          >
            <Activity className="h-2.5 w-2.5" />
            {conv.tier}
          </span>
          <span className="text-[9px] text-muted-foreground tabular-nums">{Math.round(conv.score * 100)}%</span>
        </div>
      </div>

      {/* Body: change % + sparkline */}
      <div className="flex items-end justify-between gap-2">
        <div className={cn("flex items-center gap-0.5 text-sm font-bold", up ? "text-success" : "text-danger")} dir="ltr">
          {up ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
          {up ? "+" : ""}{q.changePct.toFixed(2)}%
        </div>
        <MiniSpark history={q.history} up={up} />
      </div>

      {/* Footer: vol bar */}
      <div className="mt-1 flex items-center gap-2">
        <span className="text-[9px] uppercase tracking-wider text-muted-foreground">
          {ar ? "تقلب" : "Vol"}
        </span>
        <div className="relative h-1 flex-1 overflow-hidden rounded-full bg-border/30">
          <div
            className={cn("absolute inset-y-0 start-0 rounded-full", up ? "bg-success/70" : "bg-danger/70")}
            style={{ width: `${Math.min(q.volatility, 100)}%` }}
          />
        </div>
        <span className="text-[9px] tabular-nums text-muted-foreground">{q.volatility.toFixed(0)}</span>
      </div>

      {q.source === "synthetic" && (
        <span className="pointer-events-none absolute end-2 top-2 rounded border border-border/40 bg-background/70 px-1 py-0 text-[8px] uppercase tracking-wider text-muted-foreground">
          {ar ? "تجريبي" : "sim"}
        </span>
      )}
    </div>
  );
}

// Institutional heatmap — sorts by absolute momentum so movers float to the front.
export function MarketHeatmap({ quotes, ar, className }: Props) {
  const sorted = useMemo(
    () => [...quotes].sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct)),
    [quotes],
  );

  if (!sorted.length) {
    return (
      <div className={cn("grid gap-2 sm:grid-cols-2 lg:grid-cols-4", className)}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-28 animate-pulse rounded-xl border border-border/40 bg-muted/10" />
        ))}
      </div>
    );
  }

  // Breadth summary
  const up = sorted.filter((q) => q.changePct >= 0).length;
  const down = sorted.length - up;
  const breadth = up - down;

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
          {ar ? "الخريطة الحرارية المؤسسية" : "Institutional Heatmap"}
        </div>
        <div className="flex items-center gap-3 text-[11px] tabular-nums">
          <span className="text-success">▲ {up}</span>
          <span className="text-danger">▼ {down}</span>
          <span
            className={cn(
              "rounded-md border border-border/40 px-1.5 py-0.5 font-bold",
              breadth > 0 ? "text-success" : breadth < 0 ? "text-danger" : "text-muted-foreground",
            )}
          >
            {ar ? "الاتساع" : "Breadth"} {breadth > 0 ? "+" : ""}{breadth}
          </span>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {sorted.map((q) => (
          <HeatTile key={q.key} q={q} ar={ar} />
        ))}
      </div>
    </div>
  );
}
