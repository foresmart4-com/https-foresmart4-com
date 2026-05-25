import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { useI18n } from "@/lib/i18n";
import { useMarketIntel } from "@/hooks/useMarketIntel";
import { buildPortfolioAI } from "@/services/portfolio-ai";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Brain, Shield, Target, TrendingUp, Activity, Gauge, AlertTriangle } from "lucide-react";
import { ConfidenceBar, RiskHeat } from "@/components/dashboard/ConfidenceBar";
import { DataStatusBadge } from "@/components/DataStatusBadge";
import { cn } from "@/lib/utils";

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

  const modeLabel = pack
    ? ar
      ? ({ aggressive: "هجومي", moderate: "متوازن", conservative: "دفاعي" } as Record<string, string>)[pack.mode]
      : pack.mode.charAt(0).toUpperCase() + pack.mode.slice(1)
    : "—";

  const modeCls = pack
    ? ({ aggressive: "border-danger/40 text-danger", moderate: "border-warning/40 text-warning", conservative: "border-success/40 text-success" } as Record<string, string>)[pack.mode]
    : "border-muted text-muted-foreground";

  return (
    <div className="container mx-auto max-w-7xl space-y-6 p-4 sm:p-6">

      {/* ─── Hero ─────────────────────────────────────────────────────── */}
      <div className="ornament-border relative overflow-hidden rounded-2xl shadow-elegant">
        <div className="gradient-hero absolute inset-0 pointer-events-none" />
        <div className="relative z-10 p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-4">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl gradient-primary shadow-glow">
                <Brain className="h-6 w-6 text-primary-foreground" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
                  <Activity className="h-3.5 w-3.5" />
                  {ar ? "تحليل ذكي للمحفظة" : "AI Portfolio Intelligence"}
                </div>
                <h1 className="mt-1 font-display text-3xl font-bold sm:text-4xl">
                  <span className="text-gradient">{ar ? "محرك الذكاء للمحفظة" : "AI Portfolio Engine"}</span>
                </h1>
                <p className="mt-1 max-w-xl text-sm text-muted-foreground">
                  {ar
                    ? "تخصيص ذكي، إعادة موازنة، تحوّط، ورادار مخاطر مدعوم بالذكاء الاصطناعي."
                    : "Smart allocation, rebalancing, hedging and AI-powered risk radar."}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              {pack && (
                <>
                  <Badge variant="outline" className={cn("text-xs", modeCls)}>
                    {ar ? "الوضع:" : "Mode:"} {modeLabel}
                  </Badge>
                  <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-card/70 px-3 py-2 backdrop-blur-sm">
                    <span className="text-xs text-muted-foreground">{ar ? "الثقة" : "Confidence"}</span>
                    <span className="font-display text-lg font-bold">{pack.confidence}%</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
        <div className="relative z-10 border-t border-border/40 bg-card/30 px-5 py-2.5 sm:px-6">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="font-semibold text-primary">{ar ? "تلميح:" : "Tip:"}</span>
            {ar ? "التحليل يعتمد على بيانات السوق الحالية وخوارزميات التخصيص المحلية." : "Analysis is based on current market data and local allocation algorithms."}
            <DataStatusBadge status="simulation" className="ms-auto" />
          </div>
        </div>
      </div>

      {!pack ? (
        <Card className="gradient-card border border-border p-12 text-center text-muted-foreground shadow-card">
          {t("loading")}
        </Card>
      ) : (
        <>
          {/* ─── KPI metrics ──────────────────────────────────────────── */}
          <div className="grid gap-3 md:grid-cols-4">
            <AIMetric icon={<Gauge className="h-4 w-4" />} label={ar ? "درجة المخاطر" : "Risk Score"} value={`${pack.base.riskScore}/100`}>
              <RiskHeat value={pack.base.riskScore} className="mt-2" />
            </AIMetric>
            <AIMetric icon={<Activity className="h-4 w-4" />} label="VaR 95%" value={`${pack.radar.varPct}%`}>
              <ConfidenceBar value={Math.max(0, 100 - pack.radar.varPct * 5)} className="mt-2" />
            </AIMetric>
            <AIMetric icon={<TrendingUp className="h-4 w-4" />} label="Sharpe Ratio" value={pack.radar.sharpe.toString()} />
            <AIMetric icon={<Shield className="h-4 w-4" />} label={ar ? "أقصى هبوط" : "Max Drawdown"} value={`${pack.radar.maxDrawdown}%`} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {/* ─── Rebalance Targets ──────────────────────────────────── */}
            <Card className="gradient-card border border-border shadow-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Target className="h-4 w-4" />
                  {ar ? "إعادة موازنة مستهدفة" : "Rebalance Targets"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {pack.targets.length === 0 && (
                  <p className="text-sm text-muted-foreground">{ar ? "لا توجد توصيات" : "No suggestions"}</p>
                )}
                {pack.targets.map((tgt) => {
                  const accentCls = tgt.action === "increase" ? "border-s-success" : tgt.action === "reduce" ? "border-s-danger" : "border-s-muted-foreground/30";
                  const actionBadgeVariant: "outline" | "default" | "destructive" =
                    tgt.action === "hold" ? "outline" : tgt.action === "increase" ? "default" : "destructive";
                  const actionLabel =
                    tgt.action === "hold" ? (ar ? "تثبيت" : "Hold") :
                    tgt.action === "increase" ? (ar ? "زيادة" : "Increase") :
                    (ar ? "تخفيف" : "Reduce");
                  return (
                    <div key={tgt.asset} className={cn("space-y-1.5 rounded-md border border-border border-s-2 ps-3 py-2 pe-3", accentCls)}>
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">{tgt.assetName}</span>
                        <Badge variant={actionBadgeVariant}>{actionLabel}</Badge>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{ar ? "الحالي" : "Current"} {Math.round(tgt.current * 100)}%</span>
                        <span>→</span>
                        <span>{ar ? "الهدف" : "Target"} {Math.round(tgt.target * 100)}%</span>
                      </div>
                      <Progress value={tgt.target * 100} className="h-1.5" />
                      <p className="text-xs text-muted-foreground">{tgt.rationale}</p>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            {/* ─── Hedge Ideas ────────────────────────────────────────── */}
            <Card className="gradient-card border border-border shadow-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Shield className="h-4 w-4" />
                  {ar ? "أفكار التحوّط" : "Hedge Ideas"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {pack.hedges.map((h, i) => (
                  <div key={i} className="space-y-1.5 rounded-md border border-border p-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{h.hedge}</span>
                      <Badge variant="outline">{h.confidence}%</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {ar ? "ضد:" : "Against:"} {h.against} · {ar ? "الحجم" : "Size"} {Math.round(h.size * 100)}%
                    </p>
                    <p className="text-xs">{h.rationale}</p>
                    <ConfidenceBar value={h.confidence} className="mt-1" />
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* ─── Risk Radar ───────────────────────────────────────────── */}
          <Card className="gradient-card border border-border shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Activity className="h-4 w-4" />
                {ar ? "رادار المخاطر" : "Risk Radar"}
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6 text-sm">
              <RadarStat label="VaR 95%" v={`${pack.radar.varPct}%`} />
              <RadarStat label="CVaR" v={`${pack.radar.cvarPct}%`} />
              <RadarStat label="Sharpe" v={pack.radar.sharpe.toString()} />
              <RadarStat label="Sortino" v={pack.radar.sortino.toString()} />
              <RadarStat label="Kelly" v={`${Math.round(pack.radar.kellyAvg * 100)}%`} />
              <RadarStat label="Beta" v={pack.radar.beta.toString()} />
            </CardContent>
          </Card>

          {/* ─── Warnings ─────────────────────────────────────────────── */}
          {pack.base.warnings.length > 0 && (
            <Card className="gradient-card border border-danger/30 shadow-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base text-danger">
                  <AlertTriangle className="h-4 w-4" />
                  {ar ? "تنبيهات" : "Warnings"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5">
                {pack.base.warnings.map((w, i) => (
                  <div key={i} className="flex items-start gap-2 rounded border border-danger/20 bg-danger/5 px-2 py-1.5 text-xs text-danger">
                    <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                    {w}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function AIMetric({
  icon, label, value, children,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  children?: React.ReactNode;
}) {
  return (
    <Card className="hover-lift gradient-card border border-border shadow-card">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">{icon}{label}</div>
        <p className="mt-1 text-xl font-bold tabular-nums">{value}</p>
        {children}
      </CardContent>
    </Card>
  );
}

function RadarStat({ label, v }: { label: string; v: string }) {
  return (
    <div className="hover-lift gradient-card rounded-md border border-border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-bold tabular-nums">{v}</p>
    </div>
  );
}
