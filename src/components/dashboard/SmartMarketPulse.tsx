import { cn } from "@/lib/utils";
import { Zap, TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { AssetQuote } from "@/lib/market-data";

interface Props {
  assets: AssetQuote[];
  lang: string;
  isLoading: boolean;
}

function aiLabel(changePct: number, ar: boolean): { text: string; cls: string } {
  if (changePct > 1.5) return { text: ar ? "شراء قوي" : "Strong Buy", cls: "bg-success/15 text-success" };
  if (changePct > 0.3) return { text: ar ? "صاعد" : "Bullish", cls: "bg-success/10 text-success" };
  if (changePct < -1.5) return { text: ar ? "بيع" : "Sell", cls: "bg-danger/15 text-danger" };
  if (changePct < -0.3) return { text: ar ? "هابط" : "Bearish", cls: "bg-danger/10 text-danger" };
  return { text: ar ? "محايد" : "Neutral", cls: "bg-muted/30 text-muted-foreground" };
}

function fmt(n: number): string {
  if (n >= 10000) return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
  if (n >= 100) return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (n >= 1) return n.toLocaleString(undefined, { maximumFractionDigits: 4 });
  return n.toLocaleString(undefined, { maximumFractionDigits: 6 });
}

export function SmartMarketPulse({ assets, lang, isLoading }: Props) {
  const ar = lang === "ar";
  const display = assets.slice(0, 6);

  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/15 text-primary">
          <Zap className="h-4 w-4" />
        </span>
        <div>
          <h3 className="font-display text-lg font-bold leading-tight">
            {ar ? "نبض السوق الذكي" : "Smart Market Pulse"}
          </h3>
          <p className="text-[11px] text-muted-foreground">
            {ar ? "تفسير AI للأسواق المباشرة" : "AI interpretation of live markets"}
          </p>
        </div>
        <span className="ms-auto flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-semibold text-success">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" />
          {ar ? "مباشر" : "Live"}
        </span>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="animate-pulse rounded-xl border border-border bg-card/60 p-3">
              <div className="mb-2 h-3 w-12 rounded bg-muted/40" />
              <div className="mb-1 h-5 w-16 rounded bg-muted/40" />
              <div className="h-3 w-10 rounded bg-muted/30" />
            </div>
          ))}
        </div>
      ) : display.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card/40 py-8 text-muted-foreground">
          <Zap className="mb-2 h-6 w-6 opacity-40" />
          <p className="text-sm">{ar ? "لا توجد بيانات سوق بعد" : "No market data yet"}</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {display.map((a) => {
            const up = a.changePct >= 0;
            const label = aiLabel(a.changePct, ar);
            const Icon = up ? TrendingUp : a.changePct === 0 ? Minus : TrendingDown;
            return (
              <div
                key={a.symbol}
                className="hover-lift gradient-card rounded-xl border border-border p-3 shadow-card"
              >
                <div className="flex items-start justify-between gap-1">
                  <div className="min-w-0">
                    <div className="truncate text-xs font-bold text-foreground">{a.symbol}</div>
                    <div className="truncate text-[10px] text-muted-foreground">{a.name}</div>
                  </div>
                  <Icon
                    className={cn(
                      "mt-0.5 h-3.5 w-3.5 shrink-0",
                      up ? "text-success" : a.changePct === 0 ? "text-muted-foreground" : "text-danger",
                    )}
                  />
                </div>
                <div className="mt-2 font-display text-sm font-bold leading-tight">{fmt(a.price)}</div>
                <div
                  className={cn(
                    "mt-0.5 text-xs font-semibold",
                    up ? "text-success" : "text-danger",
                  )}
                >
                  {up ? "+" : ""}{a.changePct.toFixed(2)}%
                </div>
                <span
                  className={cn(
                    "mt-2 inline-block rounded px-1.5 py-0.5 text-[10px] font-bold uppercase",
                    label.cls,
                  )}
                >
                  {label.text}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
