import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { RefreshCw, Brain, Activity, Shield, Zap } from "lucide-react";
import type { AssetQuote } from "@/lib/market-data";
import type { MockOpportunity } from "@/lib/mock-data";

interface Props {
  lang: string;
  isFetching: boolean;
  onRefresh: () => void;
  assets: AssetQuote[];
  opportunities: MockOpportunity[];
}

export function AIStrategicHero({ lang, isFetching, onRefresh, assets, opportunities }: Props) {
  const ar = lang === "ar";

  const regime = useMemo(() => {
    if (!assets.length) return { label: ar ? "جارٍ التحليل" : "Analyzing…", cls: "text-muted-foreground" };
    const up = assets.filter((a) => a.changePct > 0).length;
    const ratio = up / assets.length;
    if (ratio > 0.6) return { label: ar ? "صاعد" : "Bullish", cls: "text-success" };
    if (ratio < 0.4) return { label: ar ? "هابط" : "Bearish", cls: "text-danger" };
    return { label: ar ? "متذبذب" : "Mixed", cls: "text-warning" };
  }, [assets, ar]);

  const avgConf = useMemo(() => {
    if (!opportunities.length) return 0;
    return Math.round(opportunities.reduce((s, o) => s + o.confidence, 0) / opportunities.length);
  }, [opportunities]);

  const chips: { icon: typeof Activity; label: string; value: string; cls: string }[] = [
    {
      icon: Activity,
      label: ar ? "وضع السوق" : "Market Regime",
      value: regime.label,
      cls: regime.cls,
    },
    {
      icon: Brain,
      label: ar ? "ثقة النظام" : "AI Confidence",
      value: avgConf ? `${avgConf}%` : "—",
      cls: avgConf >= 75 ? "text-success" : avgConf >= 60 ? "text-warning" : "text-muted-foreground",
    },
    {
      icon: Shield,
      label: ar ? "مخاطر المحفظة" : "Portfolio Risk",
      value: ar ? "متوسطة" : "Medium",
      cls: "text-warning",
    },
    {
      icon: Zap,
      label: ar ? "إشارات نشطة" : "Active Signals",
      value: opportunities.length ? String(opportunities.length) : "—",
      cls: "text-primary",
    },
  ];

  return (
    <div className="ornament-border relative overflow-hidden rounded-2xl shadow-elegant">
      <div className="gradient-hero absolute inset-0 pointer-events-none" />
      <div className="relative z-10 p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1.5 min-w-0">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-primary">
              <Brain className="h-3 w-3 shrink-0" />
              {ar ? "فور سمارت AI • مؤسسي" : "ForeSmart AI • Institutional"}
            </span>
            <h1 className="font-display text-3xl font-bold sm:text-4xl">
              <span className="text-gradient">{ar ? "مركز القيادة" : "Command Center"}</span>
            </h1>
            <p className="text-sm text-muted-foreground">
              {ar
                ? "نظرة استراتيجية شاملة مدعومة بالذكاء الاصطناعي"
                : "AI-powered strategic overview of your portfolio & markets"}
            </p>
          </div>

          <div className="flex shrink-0 flex-col items-end gap-3">
            <div className="flex flex-wrap justify-end gap-2">
              {chips.map((c) => (
                <div
                  key={c.label}
                  className="flex w-[100px] flex-col rounded-xl border border-border/60 bg-card/70 p-2.5 backdrop-blur-sm"
                >
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <c.icon className="h-3 w-3 shrink-0" />
                    <span className="truncate">{c.label}</span>
                  </div>
                  <div className={cn("mt-1 font-display text-sm font-bold leading-tight", c.cls)}>
                    {c.value}
                  </div>
                </div>
              ))}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={onRefresh}
              disabled={isFetching}
              className="shrink-0"
            >
              <RefreshCw className={cn("me-1.5 h-4 w-4", isFetching && "animate-spin")} />
              {ar ? "تحديث" : "Refresh"}
            </Button>
          </div>
        </div>
      </div>

      <div className="relative z-10 border-t border-border/40 bg-card/30 px-5 py-2.5 sm:px-6">
        <p className="text-xs text-muted-foreground">
          <span className="font-semibold text-primary">
            {ar ? "التركيز المقترح:" : "Suggested focus:"}
          </span>{" "}
          {ar
            ? "راجع إشارات الذهب والأسهم السعودية · تحقق من تنبيهات مخاطر المحفظة"
            : "Review Gold & Saudi equity signals · Check portfolio risk alerts"}
        </p>
      </div>
    </div>
  );
}
