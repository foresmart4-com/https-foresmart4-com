import { ErrorBoundary } from "@/components/ErrorBoundary";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Activity, Bitcoin, DollarSign, TrendingUp, TrendingDown, Brain, Zap,
  Newspaper, Eye, Send, ShieldAlert, Sparkles, CircleDot, Gauge, Droplet,
  BarChart3, Coins, LineChart as LineIcon, RefreshCw,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Area, AreaChart, ResponsiveContainer } from "recharts";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import { useMarketIntel } from "@/hooks/useMarketIntel";
import { AnimatedNumber } from "@/components/dashboard/AnimatedNumber";
import { ConfidenceBar, RiskHeat } from "@/components/dashboard/ConfidenceBar";
import { SegmentedTickerRibbons } from "@/components/dashboard/SegmentedTickerRibbons";
import { MarketHeatmap } from "@/components/dashboard/MarketHeatmap";
import { LiveReasoningStream } from "@/components/dashboard/LiveReasoningStream";
import { FearGreedGauge } from "@/components/dashboard/FearGreedGauge";
import { AICommandCenter } from "@/components/dashboard/AICommandCenter";
import { QuantPanel } from "@/components/dashboard/QuantPanel";
import { EdgeCommandCenter } from "@/components/dashboard/EdgeCommandCenter";
import { AdaptiveIntelligencePanel } from "@/components/dashboard/AdaptiveIntelligencePanel";
import { TacticalExecutionPanel } from "@/components/dashboard/TacticalExecutionPanel";
import { PrecisionPanel } from "@/components/dashboard/PrecisionPanel";
import { AutonomousExecutionPanel } from "@/components/dashboard/AutonomousExecutionPanel";
import { MonitoringCommandCenter } from "@/components/dashboard/MonitoringCommandCenter";
import { EmailDeliveryPanel } from "@/components/dashboard/EmailDeliveryPanel";
import { InvitationSenderPanel } from "@/components/dashboard/InvitationSenderPanel";
import { SecurityCommandCenter } from "@/components/dashboard/SecurityCommandCenter";
import { InvestmentPlansPanel } from "@/components/dashboard/InvestmentPlansPanel";
import { ExecutionControlCenter } from "@/components/dashboard/ExecutionControlCenter";
import { LiveCommandCenter } from "@/components/dashboard/LiveCommandCenter";
import { CapitalProtectionPanel } from "@/components/dashboard/CapitalProtectionPanel";
import { MasterControlCenter } from "@/components/dashboard/MasterControlCenter";
import { MarketIntelligencePanel } from "@/components/dashboard/MarketIntelligencePanel";
import { DynamicAIBrainPanel } from "@/components/dashboard/DynamicAIBrainPanel";
import { InstitutionalIntelligencePanel } from "@/components/dashboard/InstitutionalIntelligencePanel";
import { BackupStatusPanel } from "@/components/dashboard/BackupStatusPanel";
import { AIValidationPanel } from "@/components/dashboard/AIValidationPanel";
import { GlobalOpportunityScanner } from "@/components/dashboard/GlobalOpportunityScanner";
import { useAIMarketAnalyst, useAIMarketInsights } from "@/hooks/useAIBrain";
import type { AssetKey } from "@/services/market/marketData";

export const Route = createFileRoute("/_app/ai-dashboard")({
  component: () => <ErrorBoundary fallbackTitle="\u062a\u0639\u0630\u0631 \u062a\u062d\u0645\u064a\u0644 \u0627\u0644\u0635\u0641\u062d\u0629"><AIDashboardPage /></ErrorBoundary>,
  head: () => ({
    meta: [
      { title: "AI Financial Dashboard — ForeSmart" },
      { name: "description", content: "Premium AI-powered market intelligence: live signals, sentiment, news impact and watchlist." },
    ],
  }),
});

const ASSET_ICONS: Record<AssetKey, typeof Bitcoin> = {
  BTC: Bitcoin, ETH: Coins, XAU: Sparkles, SPX: TrendingUp,
  NDX: BarChart3, OIL: Droplet, DXY: DollarSign,
};

const OVERVIEW_KEYS: AssetKey[] = ["BTC", "XAU", "SPX", "DXY"];
const WATCH_KEYS: AssetKey[] = ["BTC", "ETH", "XAU", "NDX", "OIL"];

// ---------- subcomponents ----------
function GlassCard({ className, children }: { className?: string; children?: React.ReactNode }) {
  return (
    <Card className={cn(
      "border-border/50 bg-card/40 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.25)] transition-all hover:border-primary/40 hover:shadow-[0_8px_40px_rgba(99,102,241,0.18)]",
      className,
    )}>
      {children}
    </Card>
  );
}

function LiveClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const i = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(i);
  }, []);
  return <span className="font-mono text-sm tabular-nums">{now.toUTCString().slice(17, 25)} UTC</span>;
}

function ActionBadge({ action }: { action: string }) {
  const map: Record<string, string> = {
    BUY: "bg-success/15 text-success border-success/30 shadow-[0_0_12px_rgba(34,197,94,0.25)]",
    SELL: "bg-danger/15 text-danger border-danger/30 shadow-[0_0_12px_rgba(239,68,68,0.25)]",
    HOLD: "bg-warning/15 text-warning border-warning/30",
  };
  return <span className={cn("rounded-md border px-2 py-0.5 text-[11px] font-bold tracking-wider", map[action])}>{action}</span>;
}

function SentimentDot({ s }: { s: string }) {
  const c = s === "positive" ? "text-success" : s === "negative" ? "text-danger" : "text-warning";
  return <CircleDot className={cn("h-3.5 w-3.5", c)} />;
}

function relTime(ts: number, ar: boolean): string {
  const m = Math.max(1, Math.floor((Date.now() - ts) / 60000));
  if (m < 60) return ar ? `قبل ${m}د` : `${m}m ago`;
  const h = Math.floor(m / 60);
  return ar ? `قبل ${h}س` : `${h}h ago`;
}

// ---------- main ----------
function AIDashboardPage() {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const [alerts, setAlerts] = useState({ enabled: true, signals: true, news: true, highRisk: false });

  const { data, isLoading, isFetching, refetch, dataUpdatedAt, isError } = useMarketIntel(undefined, 30_000);
  const aiAnalyst = useAIMarketAnalyst(data, ar ? "ar" : "en");
  const aiInsights = useAIMarketInsights(data, ar ? "ar" : "en");
  const analyst = aiAnalyst.data?.data ?? null;
  const liveInsights = aiInsights.data?.data?.insights ?? [];

  const overviewQuotes = useMemo(
    () => (data?.quotes ?? []).filter((q) => OVERVIEW_KEYS.includes(q.key)),
    [data],
  );
  const watchlistQuotes = useMemo(
    () => (data?.quotes ?? []).filter((q) => WATCH_KEYS.includes(q.key)),
    [data],
  );
  const topSignals = useMemo(
    () => [...(data?.signals ?? [])].sort((a, b) => b.confidence - a.confidence).slice(0, 4),
    [data],
  );

  const sentimentLabel = data?.summary.sentiment === "bullish"
    ? (ar ? "متفائل" : "Bullish")
    : data?.summary.sentiment === "bearish"
    ? (ar ? "متشائم" : "Bearish")
    : (ar ? "محايد" : "Neutral");
  const sentimentTone =
    data?.summary.sentiment === "bullish" ? "text-success" :
    data?.summary.sentiment === "bearish" ? "text-danger" : "text-warning";

  const riskMap: Record<string, { label: string; tone: string }> = {
    low: { label: ar ? "منخفض" : "Low", tone: "text-success" },
    moderate: { label: ar ? "متوسط" : "Moderate", tone: "text-warning" },
    elevated: { label: ar ? "مرتفع" : "Elevated", tone: "text-warning" },
    high: { label: ar ? "عالٍ" : "High", tone: "text-danger" },
  };
  const risk = riskMap[data?.summary.riskLevel ?? "moderate"];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <div className="container mx-auto max-w-7xl space-y-6 p-6">
        {/* Header */}
        <GlassCard className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl gradient-primary shadow-glow">
                <Brain className="h-5 w-5 text-primary-foreground" />
              </div>
              <div>
                <h1 className="font-display text-xl font-bold leading-tight">
                  {ar ? "لوحة الذكاء المالي" : "AI Financial Dashboard"}
                </h1>
                <p className="text-xs text-muted-foreground">
                  {ar ? "تحليلات لحظية مدعومة بالذكاء الاصطناعي" : "Institutional-grade AI market intelligence"}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <Badge variant="outline" className="gap-1.5 border-success/40 text-success">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" />
                {ar ? "السوق مفتوح" : "Market Open"}
              </Badge>
              <Badge variant="outline" className={cn("gap-1 border-primary/40", sentimentTone)}>
                <Activity className="h-3 w-3" /> {sentimentLabel}
              </Badge>
              <Badge variant="outline" className="gap-1 border-accent/40">
                <Zap className={cn("h-3 w-3 text-accent", isFetching && "animate-pulse")} /> AI {isFetching ? (ar ? "يحلل..." : "Analyzing...") : "Online"}
              </Badge>
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <LiveClock />
              </div>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => refetch()} disabled={isFetching}>
                <RefreshCw className={cn("h-3.5 w-3.5", isFetching && "animate-spin")} />
              </Button>
            </div>
          </div>
        </GlassCard>

        {/* Segmented institutional ticker ribbons (Crypto / Indices / Commodities / FX) */}
        <SegmentedTickerRibbons quotes={data?.quotes ?? []} ar={ar} />

        {/* Institutional market heatmap */}
        <MarketHeatmap quotes={data?.quotes ?? []} ar={ar} />

        {/* Live AI reasoning stream */}
        <LiveReasoningStream quotes={data?.quotes ?? []} ar={ar} />

        {isError && (
          <GlassCard className="border-danger/40 p-3 text-sm text-danger">
            {ar ? "تعذّر الاتصال ببعض مصادر البيانات — يتم استخدام بيانات احتياطية." : "Some market sources are unavailable — using fallback data."}
          </GlassCard>
        )}

        {/* Fear & Greed + AI Insight */}
        {data && (
          <div className="grid gap-4 lg:grid-cols-3">
            <GlassCard className="p-5">
              <FearGreedGauge sentiment={data.sentiment} ar={ar} />
            </GlassCard>
            <GlassCard className="p-5 lg:col-span-2">
              <div className="mb-2 flex items-center gap-2">
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-accent to-primary text-primary-foreground shadow-glow">
                  <Sparkles className={cn("h-4 w-4", aiAnalyst.isFetching && "animate-pulse")} />
                </span>
                <div className="flex-1">
                  <h3 className="font-display text-base font-bold">
                    {analyst ? (ar ? "نظرة المحلل المؤسسي" : "Institutional Market Outlook") : data.insight.title}
                  </h3>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    {analyst ? "Lovable AI · GPT-class reasoning" : aiAnalyst.isFetching ? (ar ? "يفكر..." : "Thinking...") : (ar ? "تحليل محلي" : "On-device heuristic")}
                  </p>
                </div>
                {analyst && (
                  <Badge variant="outline" className="border-primary/40 text-[10px]">
                    {ar ? "ثقة" : "Conf"} {analyst.confidence}%
                  </Badge>
                )}
              </div>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {analyst?.outlook ?? data.insight.body}
              </p>
              {analyst && (
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {analyst.bullishShifts?.length > 0 && (
                    <div className="rounded-lg border border-success/30 bg-success/5 p-2.5">
                      <div className="mb-1 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-success">
                        <TrendingUp className="h-3 w-3" /> {ar ? "تحولات صاعدة" : "Bullish shifts"}
                      </div>
                      <ul className="space-y-0.5 text-xs text-muted-foreground">
                        {analyst.bullishShifts.slice(0, 3).map((s, i) => <li key={i}>· {s}</li>)}
                      </ul>
                    </div>
                  )}
                  {analyst.bearishShifts?.length > 0 && (
                    <div className="rounded-lg border border-danger/30 bg-danger/5 p-2.5">
                      <div className="mb-1 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-danger">
                        <TrendingDown className="h-3 w-3" /> {ar ? "تحولات هابطة" : "Bearish shifts"}
                      </div>
                      <ul className="space-y-0.5 text-xs text-muted-foreground">
                        {analyst.bearishShifts.slice(0, 3).map((s, i) => <li key={i}>· {s}</li>)}
                      </ul>
                    </div>
                  )}
                  {analyst.riskAnalysis && (
                    <div className="rounded-lg border border-warning/30 bg-warning/5 p-2.5 sm:col-span-2">
                      <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-warning">
                        {ar ? "تحليل المخاطر / دوران رأس المال" : "Risk · Capital rotation"}
                      </div>
                      <p className="text-xs text-muted-foreground">{analyst.riskAnalysis} {analyst.capitalRotation}</p>
                    </div>
                  )}
                </div>
              )}
              {liveInsights.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {liveInsights.slice(0, 5).map((ins, i) => (
                    <span key={i} className={cn(
                      "rounded-full border px-2.5 py-1 text-[11px]",
                      ins.tone === "bullish" ? "border-success/40 bg-success/10 text-success" :
                      ins.tone === "bearish" ? "border-danger/40 bg-danger/10 text-danger" :
                      "border-border/50 bg-muted/20 text-muted-foreground",
                    )}>
                      {ins.asset ? <span className="font-bold">{ins.asset}: </span> : null}{ins.text}
                    </span>
                  ))}
                </div>
              )}
            </GlassCard>
          </div>
        )}

        {/* Overview cards */}
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {isLoading && Array.from({ length: 4 }).map((_, i) => (
            <GlassCard key={i} className="h-[148px] animate-pulse p-4" />
          ))}
          {overviewQuotes.map((q) => {
            const up = q.changePct >= 0;
            const Icon = ASSET_ICONS[q.key] ?? LineIcon;
            const conf = Math.min(96, 50 + Math.round(Math.abs(q.momentum) * 20 + (50 - Math.abs(50 - q.volatility)) * 0.3));
            const chartData = q.history.map((v) => ({ v }));
            return (
              <GlassCard key={q.key} className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "grid h-9 w-9 place-items-center rounded-lg",
                      up ? "bg-success/10 text-success" : "bg-danger/10 text-danger",
                    )}>
                      <Icon className="h-4 w-4" />
                    </span>
                    <div>
                      <div className="text-xs text-muted-foreground">{q.key}</div>
                      <div className="text-sm font-semibold">{q.name}</div>
                    </div>
                  </div>
                  <Badge variant="outline" className="border-primary/30 text-[10px]">
                    <Gauge className="me-1 h-2.5 w-2.5" /> {conf}%
                  </Badge>
                </div>
                <div className="mt-3 flex items-end justify-between">
                  <div>
                    <AnimatedNumber
                      value={q.price}
                      decimals={q.price < 10 ? 4 : 2}
                      prefix="$"
                      className="font-display text-2xl font-bold tabular-nums"
                    />
                    <div className={cn("flex items-center gap-1 text-xs font-semibold", up ? "text-success" : "text-danger")}>
                      {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                      {up ? "+" : ""}{q.changePct.toFixed(2)}%
                      <span className="ms-1 text-[10px] uppercase text-muted-foreground">
                        · {q.trend}
                      </span>
                    </div>
                  </div>
                  <div className="h-12 w-24">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData}>
                        <defs>
                          <linearGradient id={`g-${q.key}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={up ? "hsl(var(--success))" : "hsl(var(--danger))"} stopOpacity={0.5} />
                            <stop offset="100%" stopColor={up ? "hsl(var(--success))" : "hsl(var(--danger))"} stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <Area type="monotone" dataKey="v" stroke={up ? "hsl(var(--success))" : "hsl(var(--danger))"} strokeWidth={1.8} fill={`url(#g-${q.key})`} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </GlassCard>
            );
          })}
        </section>

        {/* AI Summary + Watchlist */}
        <div className="grid gap-4 lg:grid-cols-3">
          <GlassCard className="p-5 lg:col-span-2">
            <div className="mb-3 flex items-center gap-2">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-primary to-accent text-primary-foreground shadow-glow">
                <Sparkles className="h-4 w-4" />
              </span>
              <div>
                <h3 className="font-display text-lg font-bold">{ar ? "ملخص الذكاء الاصطناعي" : "AI Market Summary"}</h3>
                <p className="text-[11px] text-muted-foreground">
                  {dataUpdatedAt ? (ar ? `محدث ${relTime(dataUpdatedAt, true)}` : `Updated ${relTime(dataUpdatedAt, false)}`) : (ar ? "جارٍ التحميل" : "Loading")}
                </p>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-border/50 bg-muted/20 p-3">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{ar ? "المعنويات" : "Sentiment"}</div>
                <div className={cn("mt-1 text-base font-bold", sentimentTone)}>{sentimentLabel}</div>
              </div>
              <div className="rounded-lg border border-border/50 bg-muted/20 p-3">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{ar ? "مستوى المخاطرة" : "Risk Level"}</div>
                <div className={cn("mt-1 text-base font-bold", risk.tone)}>{risk.label}</div>
              </div>
              <div className="rounded-lg border border-border/50 bg-muted/20 p-3">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{ar ? "تركيز اليوم" : "Focus Asset"}</div>
                <div className="mt-1 text-base font-bold text-primary">{data?.summary.focusAsset ?? "—"}</div>
              </div>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              {data?.summary.body ?? (ar ? "جارٍ تحليل السوق..." : "Analyzing market conditions...")}
            </p>
          </GlassCard>

          <GlassCard className="p-5">
            <div className="mb-3 flex items-center gap-2">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-accent/15 text-accent"><Eye className="h-4 w-4" /></span>
              <h3 className="font-display text-lg font-bold">{ar ? "قائمة المتابعة" : "Watchlist"}</h3>
            </div>
            <div className="space-y-2">
              {watchlistQuotes.map((w) => {
                const up = w.changePct >= 0;
                return (
                  <div key={w.key} className="flex items-center justify-between rounded-lg border border-border/40 bg-muted/10 p-2.5 transition-colors hover:bg-muted/30">
                    <div className="flex items-center gap-2">
                      <div className={cn(
                        "grid h-8 w-8 place-items-center rounded-md text-xs font-bold",
                        up ? "bg-success/10 text-success" : "bg-danger/10 text-danger",
                      )}>
                        {w.key}
                      </div>
                      <div className="text-sm font-semibold">{w.name}</div>
                    </div>
                    <div className="text-end">
                      <AnimatedNumber
                        value={w.price}
                        decimals={w.price < 10 ? 4 : 2}
                        prefix="$"
                        className="text-sm font-medium tabular-nums"
                      />
                      <div className={cn("text-[11px] font-semibold", up ? "text-success" : "text-danger")}>
                        {up ? "+" : ""}{w.changePct.toFixed(2)}%
                      </div>
                    </div>
                  </div>
                );
              })}
              {isLoading && <div className="py-6 text-center text-xs text-muted-foreground">{ar ? "جارٍ التحميل..." : "Loading..."}</div>}
            </div>
          </GlassCard>
        </div>

        {/* Signals */}
        <section>
          <div className="mb-3 flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary/15 text-primary"><Zap className="h-4 w-4" /></span>
            <h3 className="font-display text-lg font-bold">{ar ? "إشارات التداول" : "Trading Signals"}</h3>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {topSignals.map((s) => (
              <GlassCard key={s.asset} className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold">{s.assetName}</div>
                    <div className="text-[10px] uppercase text-muted-foreground">{s.asset}</div>
                  </div>
                  <ActionBadge action={s.action} />
                </div>
                <div className="mt-3 space-y-2">
                  <div>
                    <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-wider text-muted-foreground">
                      <span>{ar ? "الثقة" : "Confidence"}</span>
                      <span className="font-bold text-primary">{s.confidence}%</span>
                    </div>
                    <ConfidenceBar value={s.confidence} />
                  </div>
                  <div>
                    <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-wider text-muted-foreground">
                      <span>{ar ? "المخاطرة" : "Risk"}</span>
                      <span className={cn("font-bold", s.risk > 60 ? "text-danger" : s.risk > 40 ? "text-warning" : "text-success")}>{s.risk}</span>
                    </div>
                    <RiskHeat value={s.risk} />
                  </div>
                </div>
                <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{s.reason}</p>
                <div className="mt-2 flex items-center justify-between text-[10px] uppercase tracking-wider text-muted-foreground">
                  <span>RSI {s.rsi}</span>
                  <span>{relTime(s.timestamp, ar)}</span>
                </div>
              </GlassCard>
            ))}
            {isLoading && Array.from({ length: 4 }).map((_, i) => (
              <GlassCard key={`s-${i}`} className="h-[180px] animate-pulse p-4" />
            ))}
          </div>
        </section>

        {/* AI Command Center — Opportunities, Correlations, Events, Reasoning, Alerts */}
        {data && <AICommandCenter data={data} ar={ar} />}
        <InstitutionalIntelligencePanel intel={data} ar={ar} />

        {/* Quant Intelligence Layer */}
        {data && <QuantPanel data={data} ar={ar} />}

        {/* AI Market Intelligence Engine — Scanner, Alerts, Optimization, Macro, Backtest */}
        <MarketIntelligencePanel ar={ar} />
        <DynamicAIBrainPanel ar={ar} />
        <GlobalOpportunityScanner />
        <AIValidationPanel />
        <BackupStatusPanel ar={ar} />

        {/* Edge Discovery Center — Early momentum, breakouts, liquidity, whales, ranked ops */}
        {data && <EdgeCommandCenter data={data} ar={ar} />}

        {/* Adaptive Intelligence — learning, memory, strategy adaptation, personality, self-eval */}
        {data && <AdaptiveIntelligencePanel data={data} ar={ar} />}
        {data && <TacticalExecutionPanel data={data} ar={ar} />}
        {data && <PrecisionPanel data={data} ar={ar} />}

        <AutonomousExecutionPanel data={data} ar={ar} />

        <InvestmentPlansPanel data={data ?? null} ar={ar} />

        <ExecutionControlCenter data={data ?? null} ar={ar} />

        {/* Phase 3 — Capital Protection */}
        <CapitalProtectionPanel ar={ar} />

        {/* Phase 2 — Live Command Center */}
        <LiveCommandCenter ar={ar} />

        <MonitoringCommandCenter data={data} ar={ar} />

        <EmailDeliveryPanel />

        <div className="px-4">
          <a href="/email-diagnostics" className="inline-flex items-center text-sm text-primary underline hover:no-underline">
            {ar ? "← فتح صفحة تشخيص البريد الكاملة" : "→ Open full Email Diagnostics page"}
          </a>
        </div>

        <InvitationSenderPanel ar={ar} />

        <SecurityCommandCenter data={data} ar={ar} />

        {/* Master Phase — Institutional AI Trading Ecosystem */}
        <MasterControlCenter ar={ar} />



        {/* News + Alert settings */}
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <div className="mb-3 flex items-center gap-2">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-warning/15 text-warning"><Newspaper className="h-4 w-4" /></span>
              <h3 className="font-display text-lg font-bold">{ar ? "تأثير الأخبار" : "News Impact"}</h3>
            </div>
            <div className="space-y-3">
              {(data?.news ?? []).map((n) => (
                <GlassCard key={n.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <SentimentDot s={n.sentiment} />
                        <h4 className="font-semibold leading-tight">{n.headline}</h4>
                      </div>
                      <p className="mt-1.5 text-xs text-muted-foreground">{n.analysis}</p>
                      <div className="mt-2 max-w-[60%]">
                        <RiskHeat value={n.impactScore} />
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 text-[11px]">
                      <Badge variant="outline" className="border-primary/30">{n.asset}</Badge>
                      <Badge variant="outline" className={cn(
                        n.impact === "High" ? "border-danger/40 text-danger" :
                        n.impact === "Medium" ? "border-warning/40 text-warning" :
                        "border-muted-foreground/30 text-muted-foreground",
                      )}>
                        {n.impact}
                      </Badge>
                    </div>
                  </div>
                </GlassCard>
              ))}
              {isLoading && <GlassCard className="h-24 animate-pulse" />}
            </div>
          </div>

          <GlassCard className="h-fit p-5">
            <div className="mb-4 flex items-center gap-2">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary/15 text-primary"><Send className="h-4 w-4" /></span>
              <div>
                <h3 className="font-display text-lg font-bold">{ar ? "تنبيهات تيليجرام" : "Telegram Alerts"}</h3>
                <p className="text-[11px] text-muted-foreground">{ar ? "إعدادات الإشعارات" : "Notification settings"}</p>
              </div>
            </div>
            <div className="space-y-3">
              {[
                { k: "enabled", labelAr: "تفعيل التنبيهات", labelEn: "Enable Alerts", icon: Zap },
                { k: "signals", labelAr: "إشارات التداول", labelEn: "Signal Alerts", icon: Activity },
                { k: "news", labelAr: "تنبيهات الأخبار", labelEn: "News Alerts", icon: Newspaper },
                { k: "highRisk", labelAr: "مخاطر عالية فقط", labelEn: "High-Risk Only", icon: ShieldAlert },
              ].map((row) => {
                const Icon = row.icon;
                const v = alerts[row.k as keyof typeof alerts];
                return (
                  <div key={row.k} className="flex items-center justify-between rounded-lg border border-border/40 bg-muted/10 p-3">
                    <div className="flex items-center gap-2.5">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">{ar ? row.labelAr : row.labelEn}</span>
                    </div>
                    <Switch checked={v} onCheckedChange={(c) => setAlerts((a) => ({ ...a, [row.k]: c }))} />
                  </div>
                );
              })}
            </div>
            <Button className="mt-4 w-full" variant="outline">
              <Send className="me-2 h-4 w-4" /> {ar ? "حفظ الإعدادات" : "Save Settings"}
            </Button>
          </GlassCard>
        </div>
      </div>
    </div>
  );
}
