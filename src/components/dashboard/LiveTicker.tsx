import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import type { MarketQuote } from "@/services/market/marketData";
import { TrendingDown, TrendingUp } from "lucide-react";

interface Props { quotes: MarketQuote[]; className?: string; }

// Horizontally scrolling live price ticker with subtle pulse on update.
export function LiveTicker({ quotes, className }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);

  // Pulse every quote when prices change
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.querySelectorAll<HTMLElement>("[data-pulse]").forEach((node) => {
      node.classList.remove("ticker-flash");
      // force reflow to restart animation
      void node.offsetWidth;
      node.classList.add("ticker-flash");
    });
  }, [quotes]);

  if (!quotes.length) {
    return (
      <div className={cn("h-9 animate-pulse rounded-lg border border-border/40 bg-muted/10", className)} />
    );
  }

  const items = [...quotes, ...quotes]; // duplicate for seamless loop

  return (
    <div ref={ref} className={cn(
      "relative overflow-hidden rounded-lg border border-border/40 bg-card/30 backdrop-blur-md",
      className,
    )}>
      <div className="flex gap-6 whitespace-nowrap py-2 ticker-track">
        {items.map((q, i) => {
          const up = q.changePct >= 0;
          return (
            <div key={`${q.key}-${i}`} data-pulse className="flex items-center gap-2 px-3 text-sm">
              <span className="font-bold text-foreground/90">{q.key}</span>
              <span className="font-mono tabular-nums text-foreground">
                ${q.price < 10 ? q.price.toFixed(4) : q.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </span>
              <span className={cn("flex items-center gap-0.5 text-xs font-semibold", up ? "text-success" : "text-danger")}>
                {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {up ? "+" : ""}{q.changePct.toFixed(2)}%
              </span>
              <span className={cn("ms-1 h-1.5 w-1.5 rounded-full", up ? "bg-success" : "bg-danger", "animate-pulse")} />
            </div>
          );
        })}
      </div>
      <style>{`
        .ticker-track { animation: ticker-scroll 45s linear infinite; }
        @keyframes ticker-scroll { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
        .ticker-flash { animation: ticker-flash 0.6s ease-out; }
        @keyframes ticker-flash {
          0% { background-color: rgba(99,102,241,0.18); }
          100% { background-color: transparent; }
        }
      `}</style>
    </div>
  );
}
