import { cn } from "@/lib/utils";
import type { MarketSentimentScore } from "@/services/analysis/marketSentiment";

interface Props { sentiment: MarketSentimentScore; ar?: boolean; }

const ZONE_AR: Record<MarketSentimentScore["zone"], string> = {
  "Extreme Fear": "خوف شديد",
  "Fear": "خوف",
  "Neutral": "محايد",
  "Greed": "طمع",
  "Extreme Greed": "طمع شديد",
};

export function FearGreedGauge({ sentiment, ar }: Props) {
  const { score, zone, drivers } = sentiment;
  const tone =
    score >= 80 ? "text-success" :
    score >= 60 ? "text-success/80" :
    score >= 40 ? "text-warning" :
    score >= 20 ? "text-danger/80" : "text-danger";
  const dashOffset = 283 - (283 * score) / 100;

  return (
    <div className="flex items-center gap-4">
      <div className="relative h-24 w-24 shrink-0">
        <svg viewBox="0 0 100 100" className="-rotate-90">
          <circle cx="50" cy="50" r="45" stroke="hsl(var(--border))" strokeWidth="8" fill="none" />
          <circle
            cx="50" cy="50" r="45"
            stroke="currentColor"
            strokeWidth="8"
            strokeLinecap="round"
            fill="none"
            strokeDasharray="283"
            strokeDashoffset={dashOffset}
            className={cn(tone, "transition-all duration-700")}
          />
        </svg>
        <div className="absolute inset-0 grid place-items-center">
          <div className="text-center">
            <div className={cn("font-display text-2xl font-bold leading-none", tone)}>{score}</div>
            <div className="text-[9px] uppercase tracking-wider text-muted-foreground">/100</div>
          </div>
        </div>
      </div>
      <div className="flex-1">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
          {ar ? "مؤشر الخوف والطمع" : "Fear & Greed Index"}
        </div>
        <div className={cn("font-display text-lg font-bold", tone)}>{ar ? ZONE_AR[zone] : zone}</div>
        <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[10px]">
          {drivers.map((d) => (
            <div key={d.label} className="flex items-center justify-between">
              <span className="text-muted-foreground">{d.label}</span>
              <span className="font-mono font-semibold tabular-nums">{d.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
