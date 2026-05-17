import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Activity, Bitcoin, DollarSign, TrendingUp, TrendingDown, Brain, Zap,
  Newspaper, Eye, Send, ShieldAlert, Sparkles, CircleDot, Gauge,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Area, AreaChart, ResponsiveContainer } from "recharts";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/_app/ai-dashboard")({
  component: AIDashboardPage,
  head: () => ({
    meta: [
      { title: "AI Financial Dashboard — ForeSmart" },
      { name: "description", content: "Premium AI-powered market intelligence: live signals, sentiment, news impact and watchlist." },
    ],
  }),
});

// ---------- mock data ----------
const spark = (seed: number, trend = 1) =>
  Array.from({ length: 24 }, (_, i) => ({
    v: 100 + Math.sin((i + seed) / 3) * 8 + i * 0.4 * trend + (seed % 5),
  }));

const overviewCards = [
  { key: "BTC", name: "Bitcoin", icon: Bitcoin, price: 71420.55, change: 2.34, conf: 86, trend: "up", data: spark(1, 1) },
  { key: "XAU", name: "Gold (XAU)", icon: Sparkles, price: 2418.9, change: 0.62, conf: 74, trend: "up", data: spark(7, 0.6) },
  { key: "SPX", name: "S&P 500", icon: TrendingUp, price: 5483.12, change: -0.41, conf: 68, trend: "down", data: spark(3, -0.4) },
  { key: "DXY", name: "US Dollar Index", icon: DollarSign, price: 104.27, change: -0.18, conf: 71, trend: "down", data: spark(9, -0.3) },
];

const signals = [
  { asset: "BTC/USD", action: "BUY", conf: 87, risk: 32, reason: "Bullish breakout above $70k with strong volume confirmation.", ts: "2m ago" },
  { asset: "ETH/USD", action: "HOLD", conf: 61, risk: 45, reason: "Consolidation near resistance; awaiting macro catalyst.", ts: "9m ago" },
  { asset: "XAU/USD", action: "BUY", conf: 78, risk: 28, reason: "Safe-haven flows accelerating amid geopolitical tension.", ts: "14m ago" },
  { asset: "NDX", action: "SELL", conf: 72, risk: 58, reason: "Overbought RSI + weakening breadth across mega caps.", ts: "21m ago" },
];

const news = [
  { headline: "Fed signals patient stance on rate cuts", sentiment: "neutral", impact: "High", asset: "DXY", summary: "Markets price in Sept cut; USD softens marginally." },
  { headline: "BlackRock BTC ETF sees record inflows", sentiment: "positive", impact: "High", asset: "BTC", summary: "$520M net inflow — strongest in 6 weeks; tailwind for spot." },
  { headline: "Middle East tensions escalate", sentiment: "negative", impact: "Medium", asset: "XAU", summary: "Risk-off bid lifts gold; oil volatility rising." },
];

const watchlist = [
  { sym: "BTC", price: 71420.5, chg: 2.34 },
  { sym: "ETH", price: 3842.1, chg: 1.12 },
  { sym: "Gold", price: 2418.9, chg: 0.62 },
  { sym: "NASDAQ", price: 19234.7, chg: -0.55 },
  { sym: "Oil", price: 82.14, chg: 0.91 },
];

// ---------- subcomponents ----------
function GlassCard({ className, children }: { className?: string; children: React.ReactNode }) {
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
    BUY: "bg-success/15 text-success border-success/30",
    SELL: "bg-danger/15 text-danger border-danger/30",
    HOLD: "bg-warning/15 text-warning border-warning/30",
  };
  return <span className={cn("rounded-md border px-2 py-0.5 text-[11px] font-bold tracking-wider", map[action])}>{action}</span>;
}

function SentimentDot({ s }: { s: string }) {
  const c = s === "positive" ? "text-success" : s === "negative" ? "text-danger" : "text-warning";
  return <CircleDot className={cn("h-3.5 w-3.5", c)} />;
}

// ---------- main ----------
function AIDashboardPage() {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const [alerts, setAlerts] = useState({ enabled: true, signals: true, news: true, highRisk: false });

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
              <Badge variant="outline" className="gap-1 border-primary/40 text-primary">
                <Activity className="h-3 w-3" /> {ar ? "متفائل" : "Bullish Sentiment"}
              </Badge>
              <Badge variant="outline" className="gap-1 border-accent/40">
                <Zap className="h-3 w-3 text-accent" /> AI Online
              </Badge>
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <LiveClock />
              </div>
            </div>
          </div>
        </GlassCard>

        {/* Overview cards */}
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {overviewCards.map((c) => {
            const up = c.change >= 0;
            return (
              <GlassCard key={c.key} className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary">
                      <c.icon className="h-4 w-4" />
                    </span>
                    <div>
                      <div className="text-xs text-muted-foreground">{c.key}</div>
                      <div className="text-sm font-semibold">{c.name}</div>
                    </div>
                  </div>
                  <Badge variant="outline" className="border-primary/30 text-[10px]">
                    <Gauge className="me-1 h-2.5 w-2.5" /> {c.conf}%
                  </Badge>
                </div>
                <div className="mt-3 flex items-end justify-between">
                  <div>
                    <div className="font-display text-2xl font-bold tabular-nums">
                      ${c.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </div>
                    <div className={cn("flex items-center gap-1 text-xs font-semibold", up ? "text-success" : "text-danger")}>
                      {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                      {up ? "+" : ""}{c.change.toFixed(2)}%
                    </div>
                  </div>
                  <div className="h-12 w-24">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={c.data}>
                        <defs>
                          <linearGradient id={`g-${c.key}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={up ? "hsl(var(--success))" : "hsl(var(--danger))"} stopOpacity={0.5} />
                            <stop offset="100%" stopColor={up ? "hsl(var(--success))" : "hsl(var(--danger))"} stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <Area type="monotone" dataKey="v" stroke={up ? "hsl(var(--success))" : "hsl(var(--danger))"} strokeWidth={1.8} fill={`url(#g-${c.key})`} />
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
                <p className="text-[11px] text-muted-foreground">{ar ? "تم التحديث الآن" : "Updated moments ago"}</p>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-border/50 bg-muted/20 p-3">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{ar ? "المعنويات" : "Sentiment"}</div>
                <div className="mt-1 text-base font-bold text-success">{ar ? "متفائل" : "Bullish"}</div>
              </div>
              <div className="rounded-lg border border-border/50 bg-muted/20 p-3">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{ar ? "مستوى المخاطرة" : "Risk Level"}</div>
                <div className="mt-1 text-base font-bold text-warning">{ar ? "متوسط" : "Moderate"}</div>
              </div>
              <div className="rounded-lg border border-border/50 bg-muted/20 p-3">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{ar ? "تركيز اليوم" : "Focus Asset"}</div>
                <div className="mt-1 text-base font-bold text-primary">BTC / Gold</div>
              </div>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              {ar
                ? "تشير المؤشرات إلى استمرار الزخم الصعودي في البيتكوين مع تدفقات قوية إلى صناديق ETF، بينما يستفيد الذهب من تصاعد التوترات الجيوسياسية. ضعف طفيف في الدولار يدعم الأصول البديلة. ينصح الذكاء الاصطناعي بالتركيز على فرص الشراء التدريجي مع إدارة مخاطر صارمة."
                : "Momentum indicators favor continued strength in BTC amid record ETF inflows. Gold benefits from rising geopolitical risk premium, while the USD softens marginally. The AI recommends scaling into long positions with disciplined risk controls and tight invalidation levels."}
            </p>
          </GlassCard>

          <GlassCard className="p-5">
            <div className="mb-3 flex items-center gap-2">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-accent/15 text-accent"><Eye className="h-4 w-4" /></span>
              <h3 className="font-display text-lg font-bold">{ar ? "قائمة المتابعة" : "Watchlist"}</h3>
            </div>
            <div className="space-y-2">
              {watchlist.map((w) => {
                const up = w.chg >= 0;
                return (
                  <div key={w.sym} className="flex items-center justify-between rounded-lg border border-border/40 bg-muted/10 p-2.5 transition-colors hover:bg-muted/30">
                    <div className="flex items-center gap-2">
                      <div className="grid h-8 w-8 place-items-center rounded-md bg-primary/10 text-xs font-bold text-primary">{w.sym.slice(0, 3)}</div>
                      <div className="text-sm font-semibold">{w.sym}</div>
                    </div>
                    <div className="text-end">
                      <div className="text-sm font-medium tabular-nums">${w.price.toLocaleString()}</div>
                      <div className={cn("text-[11px] font-semibold", up ? "text-success" : "text-danger")}>
                        {up ? "+" : ""}{w.chg.toFixed(2)}%
                      </div>
                    </div>
                  </div>
                );
              })}
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
            {signals.map((s) => (
              <GlassCard key={s.asset} className="p-4">
                <div className="flex items-center justify-between">
                  <div className="font-semibold">{s.asset}</div>
                  <ActionBadge action={s.action} />
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
                  <div className="rounded-md bg-muted/20 p-2">
                    <div className="text-muted-foreground">{ar ? "الثقة" : "Confidence"}</div>
                    <div className="mt-0.5 text-sm font-bold text-primary">{s.conf}%</div>
                  </div>
                  <div className="rounded-md bg-muted/20 p-2">
                    <div className="text-muted-foreground">{ar ? "المخاطرة" : "Risk"}</div>
                    <div className={cn("mt-0.5 text-sm font-bold", s.risk > 50 ? "text-danger" : s.risk > 35 ? "text-warning" : "text-success")}>{s.risk}</div>
                  </div>
                </div>
                <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{s.reason}</p>
                <div className="mt-2 text-[10px] uppercase tracking-wider text-muted-foreground">{s.ts}</div>
              </GlassCard>
            ))}
          </div>
        </section>

        {/* News + Alert settings */}
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <div className="mb-3 flex items-center gap-2">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-warning/15 text-warning"><Newspaper className="h-4 w-4" /></span>
              <h3 className="font-display text-lg font-bold">{ar ? "تأثير الأخبار" : "News Impact"}</h3>
            </div>
            <div className="space-y-3">
              {news.map((n) => (
                <GlassCard key={n.headline} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <SentimentDot s={n.sentiment} />
                        <h4 className="font-semibold leading-tight">{n.headline}</h4>
                      </div>
                      <p className="mt-1.5 text-xs text-muted-foreground">{n.summary}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 text-[11px]">
                      <Badge variant="outline" className="border-primary/30">{n.asset}</Badge>
                      <Badge variant="outline" className={cn(
                        n.impact === "High" ? "border-danger/40 text-danger" : "border-warning/40 text-warning",
                      )}>
                        {n.impact}
                      </Badge>
                    </div>
                  </div>
                </GlassCard>
              ))}
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
