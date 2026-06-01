import { ErrorBoundary } from "@/components/ErrorBoundary";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Activity, Bitcoin, DollarSign, TrendingUp, TrendingDown, Brain, Zap,
  Newspaper, Eye, Send, ShieldAlert, Sparkles, CircleDot, Gauge, Droplet,
  BarChart3, Coins, LineChart as LineIcon, RefreshCw, Bot,
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
  component: () => <ErrorBoundary fallbackTitle="تعذر تحميل الصفحة"><AIDashboardPage /></ErrorBoundary>,
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

const OVERVIEW_KEYS: AssetKey[] = ["BTC", "ETH", "XAU", "OIL"];
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
  return <span className="font-mono text-[10px] tabular-nums">{now.toUTCString().slice(17, 25)} UTC</span>;
}

const ACTION_STYLE: Record<string, string> = {
  BUY: "bg-success/15 text-success border-success/30 shadow-[0_0_12px_rgba(34,197,94,0.25)]",
  SELL: "bg-danger/15 text-danger border-danger/30 shadow-[0_0_12px_rgba(239,68,68,0.25)]",
  HOLD: "bg-warning/15 text-warning border-warning/30",
};
const ACTION_AR: Record<string, string> = { BUY: "شراء", SELL: "بيع", HOLD: "انتظار", WAIT: "انتظار" };
const TREND_AR: Record<string, string> = { up: "صاعد", down: "هابط", flat: "أفقي" };

const REASON_PATCHES: [string, string][] = [
  ["Trend + news alignment:", "توافق الاتجاه والأخبار:"],
  ["Negative confluence:", "تعارض سلبي:"],
  ["Mixed signals — waiting for confirmation.", "إشارات متضاربة — انتظار التأكيد."],
  ["news bias", "تحيز الأخبار"],
  ["macro Greed", "جشع الماكرو"],
  ["Long bias", "تحيز صاعد"],
  ["Momentum impulse", "دفعة الزخم"],
  ["Volatility compression detected", "ضغط التقلب مرصود"],
  ["Compression +", "ضغط +"],
  ["breakout probability elevated.", "احتمالية الاختراق مرتفعة."],
  ["Historically resolves into", "تاريخياً يتحول إلى"],
  ["Probabilistic edge favors", "الحافة الاحتمالية تفضل"],
  ["Oversold", "ذروة بيع"],
  ["Overbought", "ذروة شراء"],
  ["momentum fading, distribution risk.", "تراجع الزخم، مخاطر توزيع."],
  ["stabilizing momentum", "استقرار الزخم"],
  ["supportive news flow.", "تدفق إخباري داعم."],
  ["neutral news flow.", "تدفق إخباري محايد."],
  ["size only on confirmed break", "الحجم عند الاختراق المؤكد فقط"],
  ["realized vol", "التقلب الفعلي"],
  ["elevated participation", "مشاركة مرتفعة"],
  ["continuation higher", "استمرار الصعود"],
  ["stays directional", "يبقى اتجاهياً"],
  ["macro print", "إشارة ماكرو"],
  ["news bias +100", "تحيز إخباري +100"],
  ["Cross-asset volatility is high", "تقلب متعدد الأصول: عالٍ"],
  ["Cross-asset volatility is elevated", "تقلب متعدد الأصول: مرتفع"],
  ["Cross-asset volatility is moderate", "تقلب متعدد الأصول: معتدل"],
  ["Cross-asset volatility is low", "تقلب متعدد الأصول: منخفض"],
  ["Cross-asset", "متعدد الأصول"],
  ["Leaders:", "القادة:"],
  ["Laggards:", "المتأخرون:"],
  ["Highest-conviction setup:", "أعلى إعداد قناعة:"],
  ["% confidence.", "% ثقة."],
  ["% confidence)", "% ثقة)"],
  ["with range", "مع نطاق"],
  ["balanced range", "نطاق متوازن"],
  ["mixed macro signals", "إشارات ماكرو متضاربة"],
];
function translateReason(reason: string, ar: boolean): string {
  if (!ar) return reason;
  let r = reason;
  for (const [en, arText] of REASON_PATCHES) r = r.replace(en, arText);
  return r;
}

function ActionBadge({ action }: { action: string }) {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const label = ar ? (ACTION_AR[action] ?? action) : action;
  return <span className={cn("rounded-md border px-1.5 py-0.5 text-[10px] font-bold tracking-wider", ACTION_STYLE[action])}>{label}</span>;
}

function SentimentDot({ s }: { s: string }) {
  const c = s === "positive" ? "text-success" : s === "negative" ? "text-danger" : "text-warning";
  return <CircleDot className={cn("h-3 w-3", c)} />;
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

  const { data, isLoading, isFetching, refetch, dataUpdatedAt, isError } = useMarketIntel(undefined, 30_000, ar ? "ar" : "en");
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

  const sentimentLabel = data?.summary?.sentiment === "bullish"
    ? (ar ? "متفائل" : "Bullish")
    : data?.summary?.sentiment === "bearish"
    ? (ar ? "متشائم" : "Bearish")
    : (ar ? "محايد" : "Neutral");
  const sentimentTone =
    data?.summary?.sentiment === "bullish" ? "text-success" :
    data?.summary?.sentiment === "bearish" ? "text-danger" : "text-warning";

  const riskMap: Record<string, { label: string; tone: string }> = {
    low: { label: ar ? "منخفض" : "Low", tone: "text-success" },
    moderate: { label: ar ? "متوسط" : "Moderate", tone: "text-warning" },
    elevated: { label: ar ? "مرتفع" : "Elevated", tone: "text-warning" },
    high: { label: ar ? "عالٍ" : "High", tone: "text-danger" },
  };
  const risk = riskMap[data?.summary.riskLevel ?? "moderate"];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <div className="container mx-auto max-w-[1400px] p-3">

        {/* Header */}
        <GlassCard className="p-3 mb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="grid h-8 w-8 place-items-center rounded-xl gradient-primary shadow-glow">
                <Brain className="h-4 w-4 text-primary-foreground" />
              </div>
              <div>
                <h1 className="font-display text-base font-bold leading-tight">
                  {ar ? "لوحة الذكاء المالي" : "AI Financial Dashboard"}
                </h1>
                <p className="text-[10px] text-muted-foreground">
                  {ar ? "تحليلات لحظية مدعومة بالذكاء الاصطناعي" : "Institutional-grade AI market intelligence"}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <Badge variant="outline" className="gap-1 border-success/40 text-success text-[10px]">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" />
                {ar ? "السوق مفتوح" : "Market Open"}
              </Badge>
              <Badge variant="outline" className={cn("gap-1 border-primary/40 text-[10px]", sentimentTone)}>
                <Activity className="h-3 w-3" /> {sentimentLabel}
              </Badge>
              <Badge variant="outline" className="gap-1 border-accent/40 text-[10px]">
                <Zap className={cn("h-3 w-3 text-accent", isFetching && "animate-pulse")} /> AI {isFetching ? (ar ? "يحلل..." : "Analyzing...") : "Online"}
              </Badge>
              <div className="flex items-center gap-1 text-muted-foreground">
                <LiveClock />
              </div>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => refetch()} disabled={isFetching}>
                <RefreshCw className={cn("h-3 w-3", isFetching && "animate-spin")} />
              </Button>
            </div>
          </div>
        </GlassCard>

        {/* Genesis Copilot entry */}
        <Link to="/genesis" className="block group mb-3">
          <div className="flex items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/5 px-3 py-2 transition-colors hover:border-primary/60 hover:bg-primary/10">
            <div className="flex items-center gap-2">
              <div className="grid h-7 w-7 shrink-0 place-items-center rounded-lg gradient-primary shadow-glow">
                <Bot className="h-3.5 w-3.5 text-primary-foreground" />
              </div>
              <div>
                <div className="text-xs font-semibold leading-tight">
                  {ar ? "Genesis Copilot — المساعد التفاعلي" : "Genesis Copilot — Interactive AI"}
                </div>
                <div className="text-[10px] text-muted-foreground">
                  {ar ? "اطرح أي سؤال استثماري وتلقَّ تحليلاً بنسب ثقة معايرة" : "Ask any investment question · calibrated confidence analysis"}
                </div>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1 rounded-lg border border-primary/40 bg-primary/10 px-2 py-1 text-[10px] font-semibold text-primary transition-colors group-hover:bg-primary/20">
              <Sparkles className="h-3 w-3" />
              {ar ? "افتح Genesis" : "Open Genesis"}
            </div>
          </div>
        </Link>

        {/* Ticker ribbons */}
        <div className="mb-3">
          <SegmentedTickerRibbons quotes={data?.quotes ?? []} ar={ar} />
        </div>

        {isError && (
          <GlassCard className="mb-3 border-danger/40 p-2 text-xs text-danger">
            {ar ? "تعذّر الاتصال ببعض مصادر البيانات — يتم استخدام بيانات احتياطية." : "Some market sources are unavailable — using fallback data."}
          </GlassCard>
        )}

        {/* TOP BAR — Market Overview: BTC ETH XAU OIL */}
        <div className="grid grid-cols-4 gap-2 mb-3">
          {isLoading && Array.from({ length: 4 }).map((_, i) => (
            <GlassCard key={i} className="h-[88px] animate-pulse p-2" />
          ))}
          {overviewQuotes.map((q) => {
            const up = q.changePct >= 0;
            const Icon = ASSET_ICONS[q.key as AssetKey] ?? LineIcon ?? Activity;
            const conf = Math.min(96, 50 + Math.round(Math.abs(q.momentum) * 20 + (50 - Math.abs(50 - q.volatility)) * 0.3));
            const chartData = q.history.map((v) => ({ v }));
            return (
              <GlassCard key={q.key} className="p-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className={cn(
                      "grid h-7 w-7 place-items-center rounded-lg",
                      up ? "bg-success/10 text-success" : "bg-danger/10 text-danger",
                    )}>
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    <div>
                      <div className="text-[9px] text-muted-foreground">{q.key}</div>
                      <div className="text-xs font-semibold leading-tight">{q.name}</div>
                    </div>
                  </div>
                  <Badge variant="outline" className="border-primary/30 text-[9px] px-1 py-0">
                    <Gauge className="me-0.5 h-2 w-2" /> {conf}%
                  </Badge>
                </div>
                <div className="mt-1.5 flex items-end justify-between">
                  <div>
                    <AnimatedNumber
                      value={q.price}
                      decimals={q.price < 10 ? 4 : 2}
                      prefix="$"
                      className="font-display text-base font-bold tabular-nums"
                    />
                    <div className={cn("flex items-center gap-0.5 text-[10px] font-semibold", up ? "text-success" : "text-danger")}>
                      {up ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
                      {up ? "+" : ""}{q.changePct.toFixed(2)}%
                      <span className="ms-1 text-[9px] uppercase text-muted-foreground">
                        · {ar ? (TREND_AR[q.trend] ?? q.trend) : q.trend}
                      </span>
                    </div>
                  </div>
                  <div className="h-8 w-16">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData}>
                        <defs>
                          <linearGradient id={`g-${q.key}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={up ? "hsl(var(--success))" : "hsl(var(--danger))"} stopOpacity={0.5} />
                            <stop offset="100%" stopColor={up ? "hsl(var(--success))" : "hsl(var(--danger))"} stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <Area type="monotone" dataKey="v" stroke={up ? "hsl(var(--success))" : "hsl(var(--danger))"} strokeWidth={1.5} fill={`url(#g-${q.key})`} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </GlassCard>
            );
          })}
        </div>

        {/* ROW 2 — Three columns */}
        <div className="grid grid-cols-3 gap-3 mb-3">

          {/* COLUMN 1 — ملخص الذكاء الاصطناعي + إشارات التداول */}
          <div className="space-y-3">
            {/* AI Summary */}
            <GlassCard className="p-3">
              <div className="mb-2 flex items-center gap-2">
                <span className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-primary to-accent text-primary-foreground shadow-glow">
                  <Sparkles className="h-3.5 w-3.5" />
                </span>
                <div>
                  <h3 className="font-display text-sm font-bold">{ar ? "ملخص الذكاء الاصطناعي" : "AI Market Summary"}</h3>
                  <p className="text-[10px] text-muted-foreground">
                    {dataUpdatedAt ? (ar ? `محدث ${relTime(dataUpdatedAt, true)}` : `Updated ${relTime(dataUpdatedAt, false)}`) : (ar ? "جارٍ التحميل" : "Loading")}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-1.5 mb-2">
                <div className="rounded-lg border border-border/50 bg-muted/20 p-2">
                  <div className="text-[9px] uppercase tracking-wider text-muted-foreground">{ar ? "المعنويات" : "Sentiment"}</div>
                  <div className={cn("mt-0.5 text-xs font-bold", sentimentTone)}>{sentimentLabel}</div>
                </div>
                <div className="rounded-lg border border-border/50 bg-muted/20 p-2">
                  <div className="text-[9px] uppercase tracking-wider text-muted-foreground">{ar ? "المخاطرة" : "Risk"}</div>
                  <div className={cn("mt-0.5 text-xs font-bold", risk.tone)}>{risk.label}</div>
                </div>
                <div className="rounded-lg border border-border/50 bg-muted/20 p-2">
                  <div className="text-[9px] uppercase tracking-wider text-muted-foreground">{ar ? "التركيز" : "Focus"}</div>
                  <div className="mt-0.5 text-xs font-bold text-primary">{data?.summary.focusAsset ?? "—"}</div>
                </div>
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground line-clamp-3">
                {data?.summary.body ?? (ar ? "جارٍ تحليل السوق..." : "Analyzing market conditions...")}
              </p>
            </GlassCard>

            {/* Trading Signals */}
            <div>
              <div className="mb-2 flex items-center gap-1.5">
                <span className="grid h-6 w-6 place-items-center rounded-lg bg-primary/15 text-primary"><Zap className="h-3 w-3" /></span>
                <h3 className="font-display text-sm font-bold">{ar ? "إشارات التداول" : "Trading Signals"}</h3>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {topSignals.map((s) => (
                  <GlassCard key={s.asset} className="p-2">
                    <div className="flex items-center justify-between mb-1">
                      <div>
                        <div className="text-xs font-semibold leading-tight">{s.assetName}</div>
                        <div className="text-[9px] uppercase text-muted-foreground">{s.asset}</div>
                      </div>
                      <ActionBadge action={s.action} />
                    </div>
                    <div>
                      <div className="mb-0.5 flex justify-between text-[9px] uppercase tracking-wider text-muted-foreground">
                        <span>{ar ? "الثقة" : "Conf"}</span>
                        <span className="font-bold text-primary">{s.confidence}%</span>
                      </div>
                      <ConfidenceBar value={s.confidence} />
                    </div>
                    <p className="mt-1 line-clamp-2 text-[10px] text-muted-foreground">{translateReason(s.reason, ar)}</p>
                    <div className="mt-1 flex items-center justify-between text-[9px] text-muted-foreground">
                      <span>RSI {s.rsi}</span>
                      <span>{relTime(s.timestamp, ar)}</span>
                    </div>
                  </GlassCard>
                ))}
                {isLoading && Array.from({ length: 4 }).map((_, i) => (
                  <GlassCard key={`s-${i}`} className="h-[110px] animate-pulse p-2" />
                ))}
              </div>
            </div>
          </div>

          {/* COLUMN 2 — الذكاء المؤسسي */}
          <div>
            <InstitutionalIntelligencePanel intel={data} ar={ar} />
          </div>

          {/* COLUMN 3 — طبقة الذكاء الكمي + النظام السوقي */}
          <div className="space-y-3">
            {data && <QuantPanel data={data} ar={ar} />}
            <DynamicAIBrainPanel ar={ar} />
          </div>

        </div>

        {/* ROW 3 — ذكاء التنفيذ التكتيكي + تتبع أداء الإشارات */}
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>{data && <TacticalExecutionPanel data={data} ar={ar} />}</div>
          <div><AIValidationPanel /></div>
        </div>

        {/* ROW 4 — ماسح الفرص العالمي + التقييم الذاتي */}
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div><GlobalOpportunityScanner /></div>
          <div>{data && <AdaptiveIntelligencePanel data={data} ar={ar} />}</div>
        </div>

        {/* ─── Secondary panels — full-width, below fold ─── */}
        <div className="space-y-3">

          {/* Fear & Greed + AI Institutional Analyst */}
          {data && (
            <div className="grid gap-3 lg:grid-cols-3">
              <GlassCard className="p-3">
                <FearGreedGauge sentiment={data?.sentiment ?? data?.summary?.sentiment ?? "neutral"} ar={ar} />
              </GlassCard>
              <GlassCard className="p-3 lg:col-span-2">
                <div className="mb-2 flex items-center gap-2">
                  <span className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-accent to-primary text-primary-foreground shadow-glow">
                    <Sparkles className={cn("h-3.5 w-3.5", aiAnalyst.isFetching && "animate-pulse")} />
                  </span>
                  <div className="flex-1">
                    <h3 className="font-display text-sm font-bold">
                      {analyst ? (ar ? "نظرة المحلل المؤسسي" : "Institutional Market Outlook") : (data?.insight?.title ?? "")}
                    </h3>
                    <p className="text-[9px] uppercase tracking-wider text-muted-foreground">
                      {analyst ? "Lovable AI · GPT-class reasoning" : aiAnalyst.isFetching ? (ar ? "يفكر..." : "Thinking...") : (ar ? "تحليل محلي" : "On-device heuristic")}
                    </p>
                  </div>
                  {analyst && (
                    <Badge variant="outline" className="border-primary/40 text-[10px]">
                      {ar ? "ثقة" : "Conf"} {analyst.confidence}%
                    </Badge>
                  )}
                </div>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {analyst?.outlook ?? (data?.insight?.body ?? "")}
                </p>
                {analyst && (
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    {analyst.bullishShifts?.length > 0 && (
                      <div className="rounded-lg border border-success/30 bg-success/5 p-2">
                        <div className="mb-1 flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-success">
                          <TrendingUp className="h-2.5 w-2.5" /> {ar ? "تحولات صاعدة" : "Bullish shifts"}
                        </div>
                        <ul className="space-y-0.5 text-[10px] text-muted-foreground">
                          {analyst.bullishShifts.slice(0, 3).map((s, i) => <li key={i}>· {s}</li>)}
                        </ul>
                      </div>
                    )}
                    {analyst.bearishShifts?.length > 0 && (
                      <div className="rounded-lg border border-danger/30 bg-danger/5 p-2">
                        <div className="mb-1 flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-danger">
                          <TrendingDown className="h-2.5 w-2.5" /> {ar ? "تحولات هابطة" : "Bearish shifts"}
                        </div>
                        <ul className="space-y-0.5 text-[10px] text-muted-foreground">
                          {analyst.bearishShifts.slice(0, 3).map((s, i) => <li key={i}>· {s}</li>)}
                        </ul>
                      </div>
                    )}
                    {analyst.riskAnalysis && (
                      <div className="rounded-lg border border-warning/30 bg-warning/5 p-2 sm:col-span-2">
                        <div className="mb-1 text-[9px] font-bold uppercase tracking-wider text-warning">
                          {ar ? "تحليل المخاطر / دوران رأس المال" : "Risk · Capital rotation"}
                        </div>
                        <p className="text-[10px] text-muted-foreground">{analyst.riskAnalysis} {analyst.capitalRotation}</p>
                      </div>
                    )}
                  </div>
                )}
                {liveInsights.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {liveInsights.slice(0, 5).map((ins, i) => (
                      <span key={i} className={cn(
                        "rounded-full border px-2 py-0.5 text-[10px]",
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

          {/* Watchlist */}
          <GlassCard className="p-3">
            <div className="mb-2 flex items-center gap-2">
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-accent/15 text-accent"><Eye className="h-3.5 w-3.5" /></span>
              <h3 className="font-display text-sm font-bold">{ar ? "قائمة المتابعة" : "Watchlist"}</h3>
            </div>
            <div className="grid gap-1.5 sm:grid-cols-3 lg:grid-cols-5">
              {watchlistQuotes.map((w) => {
                const up = w.changePct >= 0;
                return (
                  <div key={w.key} className="flex items-center justify-between rounded-lg border border-border/40 bg-muted/10 p-2 transition-colors hover:bg-muted/30">
                    <div className="flex items-center gap-1.5">
                      <div className={cn(
                        "grid h-7 w-7 place-items-center rounded-md text-[10px] font-bold",
                        up ? "bg-success/10 text-success" : "bg-danger/10 text-danger",
                      )}>
                        {w.key}
                      </div>
                      <div className="text-xs font-semibold">{w.name}</div>
                    </div>
                    <div className="text-end">
                      <AnimatedNumber
                        value={w.price}
                        decimals={w.price < 10 ? 4 : 2}
                        prefix="$"
                        className="text-xs font-medium tabular-nums"
                      />
                      <div className={cn("text-[10px] font-semibold", up ? "text-success" : "text-danger")}>
                        {up ? "+" : ""}{w.changePct.toFixed(2)}%
                      </div>
                    </div>
                  </div>
                );
              })}
              {isLoading && <div className="py-4 text-center text-xs text-muted-foreground col-span-full">{ar ? "جارٍ التحميل..." : "Loading..."}</div>}
            </div>
          </GlassCard>

          {/* Heatmap + Reasoning */}
          <MarketHeatmap quotes={data?.quotes ?? []} ar={ar} />
          <LiveReasoningStream quotes={data?.quotes ?? []} ar={ar} />

          {/* AI Command Center */}
          {data && <AICommandCenter data={data} ar={ar} />}

          {/* Market Intelligence */}
          <MarketIntelligencePanel ar={ar} />
          <BackupStatusPanel ar={ar} />

          {/* Edge Discovery */}
          {data && <EdgeCommandCenter data={data} ar={ar} />}

          {/* Precision + Autonomous */}
          {data && <PrecisionPanel data={data} ar={ar} />}
          <ErrorBoundary fallbackTitle="تعذر تحميل هذا الجزء"><AutonomousExecutionPanel data={data} ar={ar} /></ErrorBoundary>
          <InvestmentPlansPanel data={data ?? null} ar={ar} />
          <ErrorBoundary fallbackTitle="تعذر تحميل هذا الجزء"><ExecutionControlCenter data={data ?? null} ar={ar} /></ErrorBoundary>
          <ErrorBoundary fallbackTitle="تعذر تحميل هذا الجزء"><CapitalProtectionPanel ar={ar} /></ErrorBoundary>
          <ErrorBoundary fallbackTitle="تعذر تحميل هذا الجزء"><LiveCommandCenter ar={ar} /></ErrorBoundary>
          <ErrorBoundary fallbackTitle="تعذر تحميل هذا الجزء"><MonitoringCommandCenter data={data} ar={ar} /></ErrorBoundary>
          <ErrorBoundary fallbackTitle="تعذر تحميل هذا الجزء"><EmailDeliveryPanel /></ErrorBoundary>

          <div className="px-2">
            <a href="/email-diagnostics" className="inline-flex items-center text-xs text-primary underline hover:no-underline">
              {ar ? "← فتح صفحة تشخيص البريد الكاملة" : "→ Open full Email Diagnostics page"}
            </a>
          </div>

          <ErrorBoundary fallbackTitle="تعذر تحميل هذا الجزء"><InvitationSenderPanel ar={ar} /></ErrorBoundary>
          <SecurityCommandCenter data={data} ar={ar} />
          <ErrorBoundary fallbackTitle="تعذر تحميل هذا الجزء"><MasterControlCenter ar={ar} /></ErrorBoundary>

          {/* News + Alert settings */}
          <div className="grid gap-3 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <div className="mb-2 flex items-center gap-2">
                <span className="grid h-7 w-7 place-items-center rounded-lg bg-warning/15 text-warning"><Newspaper className="h-3.5 w-3.5" /></span>
                <h3 className="font-display text-sm font-bold">{ar ? "تأثير الأخبار" : "News Impact"}</h3>
              </div>
              <div className="space-y-2">
                {(data?.news ?? []).map((n) => (
                  <GlassCard key={n.id} className="p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-1.5">
                          <SentimentDot s={n.sentiment} />
                          <h4 className="text-xs font-semibold leading-tight">{n.headline}</h4>
                        </div>
                        <p className="mt-1 text-[10px] text-muted-foreground">{n.analysis}</p>
                        <div className="mt-1.5 max-w-[60%]">
                          <RiskHeat value={n.impactScore} />
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1 text-[10px]">
                        <Badge variant="outline" className="border-primary/30 text-[9px]">{n.asset}</Badge>
                        <Badge variant="outline" className={cn(
                          "text-[9px]",
                          n.impact === "High" ? "border-danger/40 text-danger" :
                          n.impact === "Medium" ? "border-warning/40 text-warning" :
                          "border-muted-foreground/30 text-muted-foreground",
                        )}>
                          {ar ? (n.impact === "High" ? "عالي" : n.impact === "Medium" ? "متوسط" : "منخفض") : n.impact}
                        </Badge>
                      </div>
                    </div>
                  </GlassCard>
                ))}
                {isLoading && <GlassCard className="h-20 animate-pulse" />}
              </div>
            </div>

            <GlassCard className="h-fit p-3">
              <div className="mb-3 flex items-center gap-2">
                <span className="grid h-7 w-7 place-items-center rounded-lg bg-primary/15 text-primary"><Send className="h-3.5 w-3.5" /></span>
                <div>
                  <h3 className="font-display text-sm font-bold">{ar ? "تنبيهات تيليجرام" : "Telegram Alerts"}</h3>
                  <p className="text-[10px] text-muted-foreground">{ar ? "إعدادات الإشعارات" : "Notification settings"}</p>
                </div>
              </div>
              <div className="space-y-2">
                {[
                  { k: "enabled", labelAr: "تفعيل التنبيهات", labelEn: "Enable Alerts", icon: Zap },
                  { k: "signals", labelAr: "إشارات التداول", labelEn: "Signal Alerts", icon: Activity },
                  { k: "news", labelAr: "تنبيهات الأخبار", labelEn: "News Alerts", icon: Newspaper },
                  { k: "highRisk", labelAr: "مخاطر عالية فقط", labelEn: "High-Risk Only", icon: ShieldAlert },
                ].map((row) => {
                  const Icon = row.icon ?? Activity;
                  const v = alerts[row.k as keyof typeof alerts];
                  return (
                    <div key={row.k} className="flex items-center justify-between rounded-lg border border-border/40 bg-muted/10 p-2">
                      <div className="flex items-center gap-2">
                        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-xs font-medium">{ar ? row.labelAr : row.labelEn}</span>
                      </div>
                      <Switch checked={v} onCheckedChange={(c) => setAlerts((a) => ({ ...a, [row.k]: c }))} />
                    </div>
                  );
                })}
              </div>
              <Button className="mt-3 w-full h-8 text-xs" variant="outline">
                <Send className="me-2 h-3.5 w-3.5" /> {ar ? "حفظ الإعدادات" : "Save Settings"}
              </Button>
            </GlassCard>
          </div>

        </div>
      </div>
    </div>
  );
}
