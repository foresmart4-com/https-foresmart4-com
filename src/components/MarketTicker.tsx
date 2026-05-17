import { tickerItems } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

export function MarketTicker({ className }: { className?: string }) {
  const items = [...tickerItems, ...tickerItems];
  return (
    <div className={cn("overflow-hidden border-y border-border/40 bg-background/40 backdrop-blur-sm", className)}>
      <div className="flex animate-[ticker_45s_linear_infinite] whitespace-nowrap py-2">
        {items.map((it, i) => (
          <div key={i} className="mx-6 flex items-center gap-2 text-xs">
            <span className="font-semibold tracking-wide text-foreground/90">{it.sym}</span>
            <span className="text-muted-foreground">{it.val}</span>
            <span className={cn("font-semibold", it.up ? "text-success" : "text-danger")}>{it.chg}</span>
          </div>
        ))}
      </div>
      <style>{`
        @keyframes ticker {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
}
