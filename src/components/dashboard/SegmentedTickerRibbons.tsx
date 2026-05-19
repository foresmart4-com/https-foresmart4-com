import { useEffect, useMemo, useRef } from "react";
import { cn } from "@/lib/utils";
import type { MarketQuote, AssetKey } from "@/services/market/marketData";
import { Bitcoin, BarChart3, Fuel, DollarSign, TrendingDown, TrendingUp, Minus } from "lucide-react";

interface Props {
  quotes: MarketQuote[];
  ar?: boolean;
  className?: string;
}

type SegmentId = "crypto" | "indices" | "commodities" | "fx";

interface SegmentDef {
  id: SegmentId;
  labelEn: string;
  labelAr: string;
  keys: AssetKey[];
  Icon: typeof Bitcoin;
  accent: string; // tailwind text color token
  ring: string;
  speedSec: number;
}

const SEGMENTS: SegmentDef[] = [
  { id: "crypto",      labelEn: "Crypto",       labelAr: "العملات الرقمية", keys: ["BTC", "ETH"],    Icon: Bitcoin,    accent: "text-amber-400",  ring: "ring-amber-400/20",  speedSec: 38 },
  { id: "indices",     labelEn: "Indices",      labelAr: "المؤشرات",        keys: ["SPX", "NDX"],    Icon: BarChart3,  accent: "text-sky-400",    ring: "ring-sky-400/20",    speedSec: 44 },
  { id: "commodities", labelEn: "Commodities",  labelAr: "السلع",           keys: ["XAU", "OIL"],    Icon: Fuel,       accent: "text-emerald-400",ring: "ring-emerald-400/20",speedSec: 42 },
  { id: "fx",          labelEn: "FX & Macro",   labelAr: "العملات والماكرو", keys: ["DXY"],           Icon: DollarSign, accent: "text-violet-400", ring: "ring-violet-400/20", speedSec: 50 },
];

function fmtPrice(p: number) {
  if (p >= 1000) return p.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (p >= 10) return p.toFixed(2);
  return p.toFixed(4);
}

function Sparkline({ history, up }: { history: number[]; up: boolean }) {
  if (!history?.length) return null;
  const min = Math.min(...history);
  const max = Math.max(...history);
  const range = max - min || 1;
  const w = 56, h = 16;
  const step = w / (history.length - 1 || 1);
  const d = history.map((v, i) => `${i === 0 ? "M" : "L"}${(i * step).toFixed(2)},${(h - ((v - min) / range) * h).toFixed(2)}`).join(" ");
  return (
    <svg width={w} height={h} className="opacity-80">
      <path d={d} fill="none" stroke="currentColor" strokeWidth="1.5" className={up ? "text-success" : "text-danger"} />
    </svg>
  );
}

function Ribbon({ segment, quotes, ar }: { segment: SegmentDef; quotes: MarketQuote[]; ar?: boolean }) {
  const items = quotes.filter((q) => segment.keys.includes(q.key));
  const trackRef = useRef<HTMLDivElement | null>(null);

  // pulse on update
  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    el.querySelectorAll<HTMLElement>("[data-pulse]").forEach((node) => {
      node.classList.remove("ribbon-flash");
      void node.offsetWidth;
      node.classList.add("ribbon-flash");
    });
  }, [quotes]);

  const aggUp = items.filter((q) => q.changePct >= 0).length;
  const aggDown = items.length - aggUp;
  const bias: "up" | "down" | "flat" = aggUp > aggDown ? "up" : aggDown > aggUp ? "down" : "flat";
  const BiasIcon = bias === "up" ? TrendingUp : bias === "down" ? TrendingDown : Minus;
  const biasColor = bias === "up" ? "text-success" : bias === "down" ? "text-danger" : "text-muted-foreground";

  if (!items.length) {
    return (
      <div className="h-11 animate-pulse rounded-lg border border-border/40 bg-muted/10" />
    );
  }

  const loop = [...items, ...items, ...items];

  return (
    <div className={cn(
      "group relative flex items-stretch overflow-hidden rounded-lg border border-border/40 bg-card/40 backdrop-blur-md ring-1",
      segment.ring,
    )}>
      {/* Class label */}
      <div className={cn(
        "flex shrink-0 items-center gap-2 border-e border-border/40 bg-background/40 px-3 py-2 text-xs font-semibold tracking-wide",
      )}>
        <segment.Icon className={cn("h-3.5 w-3.5", segment.accent)} />
        <span className="uppercase text-foreground/90">{ar ? segment.labelAr : segment.labelEn}</span>
        <span className={cn("inline-flex items-center gap-0.5 text-[10px] font-bold", biasColor)}>
          <BiasIcon className="h-3 w-3" />
          {aggUp}/{items.length}
        </span>
      </div>

      {/* Scrolling track */}
      <div ref={trackRef} className="relative flex-1 overflow-hidden">
        <div
          className="flex gap-5 whitespace-nowrap py-2 ribbon-track"
          style={{ animationDuration: `${segment.speedSec}s` }}
        >
          {loop.map((q, i) => {
            const up = q.changePct >= 0;
            return (
              <div key={`${segment.id}-${q.key}-${i}`} data-pulse className="flex items-center gap-2 px-3 text-sm">
                <span className="font-bold text-foreground/90">{q.key}</span>
                <span className="hidden text-xs text-muted-foreground sm:inline">{q.name}</span>
                <span className="font-mono tabular-nums text-foreground" dir="ltr">${fmtPrice(q.price)}</span>
                <Sparkline history={q.history} up={up} />
                <span className={cn("flex items-center gap-0.5 text-xs font-semibold", up ? "text-success" : "text-danger")} dir="ltr">
                  {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  {up ? "+" : ""}{q.changePct.toFixed(2)}%
                </span>
                <span className={cn("ms-1 h-1.5 w-1.5 rounded-full", up ? "bg-success" : "bg-danger", "animate-pulse")} />
                {q.source === "synthetic" && (
                  <span className="rounded border border-border/40 px-1 py-0 text-[9px] uppercase tracking-wider text-muted-foreground">
                    {ar ? "تجريبي" : "sim"}
                  </span>
                )}
              </div>
            );
          })}
        </div>
        {/* edge fade */}
        <div className="pointer-events-none absolute inset-y-0 start-0 w-8 bg-gradient-to-e from-card/80 to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 end-0 w-8 bg-gradient-to-w from-card/80 to-transparent" />
      </div>
    </div>
  );
}

// Segmented institutional ribbons — one row per asset class.
export function SegmentedTickerRibbons({ quotes, ar, className }: Props) {
  const segments = useMemo(() => SEGMENTS, []);
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {segments.map((s) => (
        <Ribbon key={s.id} segment={s} quotes={quotes} ar={ar} />
      ))}
      <style>{`
        .ribbon-track { animation-name: ribbon-scroll; animation-timing-function: linear; animation-iteration-count: infinite; }
        @keyframes ribbon-scroll { 0% { transform: translateX(0); } 100% { transform: translateX(-33.333%); } }
        [dir="rtl"] .ribbon-track { animation-name: ribbon-scroll-rtl; }
        @keyframes ribbon-scroll-rtl { 0% { transform: translateX(0); } 100% { transform: translateX(33.333%); } }
        .ribbon-flash { animation: ribbon-flash 0.7s ease-out; }
        @keyframes ribbon-flash {
          0% { background-color: color-mix(in oklab, currentColor 14%, transparent); }
          100% { background-color: transparent; }
        }
        .group:hover .ribbon-track { animation-play-state: paused; }
        .bg-gradient-to-e { background-image: linear-gradient(to right, var(--tw-gradient-stops)); }
        .bg-gradient-to-w { background-image: linear-gradient(to left, var(--tw-gradient-stops)); }
        [dir="rtl"] .bg-gradient-to-e { background-image: linear-gradient(to left, var(--tw-gradient-stops)); }
        [dir="rtl"] .bg-gradient-to-w { background-image: linear-gradient(to right, var(--tw-gradient-stops)); }
      `}</style>
    </div>
  );
}
