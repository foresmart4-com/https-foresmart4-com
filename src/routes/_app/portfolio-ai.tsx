import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { useI18n } from "@/lib/i18n";
import { useMarketIntel } from "@/hooks/useMarketIntel";
import { buildPortfolioAI } from "@/services/portfolio-ai";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Brain, Shield, Target, TrendingUp, Activity, Gauge } from "lucide-react";

export const Route = createFileRoute("/_app/portfolio-ai")({
  component: PortfolioAIPage,
  head: () => ({
    meta: [
      { title: "AI Portfolio — ForeSmart" },
      { name: "description", content: "Autonomous AI portfolio: allocation, rebalance, hedge, risk radar." },
    ],
  }),
});

function PortfolioAIPage() {
  const { lang, t } = useI18n();
  const ar = lang === "ar";
  const { data } = useMarketIntel(undefined, 60_000);
  const pack = useMemo(() => (data ? buildPortfolioAI(data) : null), [data]);

  if (!pack) {
    return (
      <div className="container mx-auto max-w-7xl p-4 sm:p-6">
        <div className="grid place-items-center py-16 text-muted-foreground">{t("loading")}</div>
      </div>
    );
  }

  const modeLabel = ar
    ? { aggressive: "هجومي", moderate: "متوازن", conservative: "دفاعي" }[pack.mode]
    : pack.mode.charAt(0).toUpperCase() + pack.mode.slice(1);

  return (
    <div className="container mx-auto max-w-7xl space-y-4 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            {ar ? "محرك الذكاء للمحفظة" : "AI Portfolio Engine"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {ar ? "تخصيص ذكي، إعادة موازنة، تحوّط، ورادار مخاطر." : "Smart allocation, rebalance, hedging and risk radar."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline">{ar ? "الوضع:" : "Mode:"} {modeLabel}</Badge>
          <Badge>{ar ? "الثقة" : "Confidence"} {pack.confidence}%</Badge>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <Metric icon={<Gauge className="h-4 w-4" />} label={ar ? "درجة المخاطر" : "Risk Score"} value={`${pack.base.riskScore}/100`} />
        <Metric icon={<Activity className="h-4 w-4" />} label="VaR 95%" value={`${pack.radar.varPct}%`} />
        <Metric icon={<TrendingUp className="h-4 w-4" />} label="Sharpe" value={pack.radar.sharpe.toString()} />
        <Metric icon={<Shield className="h-4 w-4" />} label={ar ? "أقصى هبوط" : "Max DD"} value={`${pack.radar.maxDrawdown}%`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Target className="h-4 w-4" />{ar ? "إعادة موازنة مستهدفة" : "Rebalance Targets"}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {pack.targets.length === 0 && <p className="text-sm text-muted-foreground">{ar ? "لا توجد توصيات" : "No suggestions"}</p>}
            {pack.targets.map((tgt) => (
              <div key={tgt.asset} className="space-y-1 rounded-md border p-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{tgt.assetName}</span>
                  <Badge variant={tgt.action === "hold" ? "outline" : tgt.action === "increase" ? "default" : "destructive"}>
                    {tgt.action === "hold" ? (ar ? "تثبيت" : "Hold") : tgt.action === "increase" ? (ar ? "زيادة" : "Increase") : (ar ? "تخفيف" : "Reduce")}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{ar ? "الحالي" : "Current"} {Math.round(tgt.current * 100)}%</span>
                  <span>→</span>
                  <span>{ar ? "الهدف" : "Target"} {Math.round(tgt.target * 100)}%</span>
                </div>
                <Progress value={tgt.target * 100} className="h-1.5" />
                <p className="text-xs text-muted-foreground">{tgt.rationale}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Shield className="h-4 w-4" />{ar ? "أفكار التحوّط" : "Hedge Ideas"}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {pack.hedges.map((h, i) => (
              <div key={i} className="rounded-md border p-3 space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{h.hedge}</span>
                  <Badge variant="outline">{h.confidence}%</Badge>
                </div>
                <p className="text-xs text-muted-foreground">{ar ? "ضد:" : "Against:"} {h.against} · {ar ? "الحجم" : "Size"} {Math.round(h.size * 100)}%</p>
                <p className="text-xs">{h.rationale}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">{ar ? "رادار المخاطر" : "Risk Radar"}</CardTitle></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6 text-sm">
          <RadarStat label="VaR 95%" v={`${pack.radar.varPct}%`} />
          <RadarStat label="CVaR" v={`${pack.radar.cvarPct}%`} />
          <RadarStat label="Sharpe" v={pack.radar.sharpe.toString()} />
          <RadarStat label="Sortino" v={pack.radar.sortino.toString()} />
          <RadarStat label="Kelly" v={`${Math.round(pack.radar.kellyAvg * 100)}%`} />
          <RadarStat label="Beta" v={pack.radar.beta.toString()} />
        </CardContent>
      </Card>

      {pack.base.warnings.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base text-destructive">{ar ? "تنبيهات" : "Warnings"}</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            {pack.base.warnings.map((w, i) => <p key={i}>• {w}</p>)}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">{icon}{label}</div>
        <p className="mt-1 text-xl font-bold tabular-nums">{value}</p>
      </CardContent>
    </Card>
  );
}

function RadarStat({ label, v }: { label: string; v: string }) {
  return (
    <div className="rounded-md border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-bold tabular-nums">{v}</p>
    </div>
  );
}
