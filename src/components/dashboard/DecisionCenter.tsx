import { cn } from "@/lib/utils";
import { Brain, Target, AlertTriangle, Shield, TrendingUp, TrendingDown, Eye, Bookmark } from "lucide-react";
import { ConfidenceBar, RiskHeat } from "@/components/dashboard/ConfidenceBar";
import type { MockOpportunity } from "@/lib/mock-data";
import { Button } from "@/components/ui/button";
import { addToWatchlist } from "@/lib/watchlistStore";
import { toast } from "sonner";

interface Props {
  opportunities: MockOpportunity[];
  lang: string;
}

const SIGNAL_STRIPE: Record<string, string> = {
  buy:   "bg-success",
  sell:  "bg-danger",
  watch: "bg-primary",
  hold:  "bg-warning",
};

const SIGNAL_BADGE: Record<string, string> = {
  buy:   "bg-success/15 text-success",
  sell:  "bg-danger/15 text-danger",
  watch: "bg-primary/15 text-primary",
  hold:  "bg-warning/15 text-warning",
};

const SIGNAL_ICON: Record<string, typeof TrendingUp> = {
  buy:   TrendingUp,
  sell:  TrendingDown,
  watch: Eye,
  hold:  Target,
};

function signalLabel(signal: string, ar: boolean): string {
  if (signal === "buy")   return ar ? "شراء" : "Buy";
  if (signal === "sell")  return ar ? "بيع" : "Sell";
  if (signal === "watch") return ar ? "مراقبة" : "Watch";
  return ar ? "احتفاظ" : "Hold";
}

export function DecisionCenter({ opportunities, lang }: Props) {
  const ar = lang === "ar";

  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-accent/15 text-accent">
          <Brain className="h-4 w-4" />
        </span>
        <div>
          <h3 className="font-display text-lg font-bold leading-tight">
            {ar ? "مركز القرار" : "Decision Center"}
          </h3>
          <p className="text-[11px] text-muted-foreground">
            {ar ? "أفضل الفرص والتحذيرات الآن" : "Top opportunities & risk warnings now"}
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {opportunities.map((o) => {
          const Icon = SIGNAL_ICON[o.signal] ?? Target;
          const isUrgent = o.signal === "buy" && o.confidence >= 80;
          const isRisk = o.signal === "sell" || o.confidence < 65;

          return (
            <div
              key={o.symbol}
              className="hover-lift gradient-card relative overflow-hidden rounded-xl border border-border shadow-card"
            >
              <div className={cn("h-1 w-full", SIGNAL_STRIPE[o.signal] ?? "bg-border")} />
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate font-semibold leading-tight">
                      {ar ? o.name_ar : o.name_en}
                    </div>
                    <div className="text-xs text-muted-foreground">{o.symbol}</div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span
                      className={cn(
                        "flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase",
                        SIGNAL_BADGE[o.signal],
                      )}
                    >
                      <Icon className="h-2.5 w-2.5" />
                      {signalLabel(o.signal, ar)}
                    </span>
                    {isUrgent && (
                      <span className="rounded-full bg-primary/20 px-1.5 py-0.5 text-[10px] font-bold text-primary">
                        {ar ? "عاجل" : "Urgent"}
                      </span>
                    )}
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-x-3 text-xs">
                  <div>
                    <div className="text-muted-foreground">{ar ? "الثقة" : "Confidence"}</div>
                    <div className="font-semibold text-foreground">{o.confidence}%</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">{ar ? "التغيير" : "Change"}</div>
                    <div
                      className={cn(
                        "font-semibold",
                        o.change >= 0 ? "text-success" : "text-danger",
                      )}
                    >
                      {o.change >= 0 ? "+" : ""}
                      {o.change.toFixed(2)}%
                    </div>
                  </div>
                </div>

                <ConfidenceBar value={o.confidence} className="mt-3" />

                {isRisk && (
                  <div className="mt-2 flex items-center gap-1.5 rounded-lg border border-danger/20 bg-danger/5 px-2 py-1.5 text-[10px] text-danger">
                    <AlertTriangle className="h-3 w-3 shrink-0" />
                    {ar ? "تحذير مخاطر — راجع نقطة الوقف" : "Risk warning — review stop level"}
                  </div>
                )}

                <div className="mt-3 border-t border-border/40 pt-2.5">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 w-full gap-1.5 text-[11px]"
                    onClick={() => {
                      const ok = addToWatchlist({
                        symbol: o.symbol,
                        name: ar ? o.name_ar : o.name_en,
                        category: "other" as any,
                        price: 0,
                        change24h: o.change,
                        currency: "USD",
                      });
                      toast[ok ? "success" : "info"](
                        ar
                          ? (ok ? `أُضيف ${o.symbol} للمراقبة` : "موجود بالفعل")
                          : (ok ? `${o.symbol} added to watchlist` : "Already in watchlist"),
                      );
                    }}
                  >
                    <Bookmark className="h-3 w-3" />
                    {ar ? "إضافة للمراقبة" : "Add to watchlist"}
                  </Button>
                </div>
              </div>
            </div>
          );
        })}

        {/* AI Risk Guard — static institutional card */}
        <div className="hover-lift gradient-card relative overflow-hidden rounded-xl border border-border shadow-card">
          <div className="h-1 w-full bg-accent" />
          <div className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="font-semibold leading-tight">
                  {ar ? "حارس المخاطر AI" : "AI Risk Guard"}
                </div>
                <div className="text-xs text-muted-foreground">
                  {ar ? "حماية المحفظة" : "Portfolio protection"}
                </div>
              </div>
              <span className="flex shrink-0 items-center gap-1 rounded-md bg-accent/15 px-2 py-0.5 text-[10px] font-bold text-accent">
                <Shield className="h-2.5 w-2.5" />
                {ar ? "نشط" : "Active"}
              </span>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {ar
                ? "لا توجد مستويات وقف خسارة حرجة حالياً. المراجعة القادمة خلال 4 ساعات."
                : "No critical stop-loss levels breached. Next review in 4 hours."}
            </p>
            <div className="mt-3 text-[10px] text-muted-foreground">
              {ar ? "درجة المخاطر الكلية" : "Overall risk score"}
            </div>
            <RiskHeat value={42} className="mt-1" />
            <div className="mt-1 text-right text-[10px] font-semibold text-warning">
              42 / 100 — {ar ? "متوسط" : "Medium"}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
