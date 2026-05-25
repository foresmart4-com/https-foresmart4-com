import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useMemo } from "react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { getMarketData, deriveSignal, type AssetQuote, type AssetCategory } from "@/lib/market-data";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { PriceChart } from "@/components/PriceChart";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  TrendingUp, RefreshCw, Save,
  Wallet, PieChart, DollarSign, Activity, ShieldAlert, Bell, Target,
  Brain, Zap, Eye,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  portfolioKpis,
  portfolioPerformance,
  aiAlerts,
  topOpportunities,
  portfolioAllocation,
} from "@/lib/mock-data";
import { AIStrategicHero } from "@/components/dashboard/AIStrategicHero";
import { SmartMarketPulse } from "@/components/dashboard/SmartMarketPulse";
import { DecisionCenter } from "@/components/dashboard/DecisionCenter";

export const Route = createFileRoute("/_app/dashboard")({
  component: DashboardPage,
  head: () => ({
    meta: [
      { title: "Dashboard — ForeSmart" },
      { name: "description", content: "Live market dashboard: KPIs, AI alerts, top opportunities, charts and signals across crypto, metals and currencies." },
      { property: "og:title", content: "ForeSmart Dashboard" },
      { property: "og:url", content: "https://foresmart4.store/dashboard" },
    ],
    links: [{ rel: "canonical", href: "https://foresmart4.store/dashboard" }],
  }),
});

const KPI_ICONS = [Wallet, DollarSign, PieChart, TrendingUp, Activity, ShieldAlert] as const;
const TONE_CLS: Record<string, string> = {
  primary: "text-primary bg-primary/10",
  success: "text-success bg-success/10",
  danger:  "text-danger bg-danger/10",
  warning: "text-warning bg-warning/10",
  muted:   "text-muted-foreground bg-muted/30",
};

const QUICK_ACTIONS = [
  {
    to: "/advisor",
    icon: Brain,
    label_en: "Ask AI Advisor",
    label_ar: "اسأل المستشار AI",
    desc_en: "Query market & portfolio",
    desc_ar: "استفسر عن السوق والمحفظة",
    cls: "border-primary/30 bg-primary/10 text-primary hover:bg-primary/20",
  },
  {
    to: "/signals",
    icon: Zap,
    label_en: "View Signals",
    label_ar: "عرض الإشارات",
    desc_en: "Live AI trade signals",
    desc_ar: "إشارات تداول AI حية",
    cls: "border-success/30 bg-success/10 text-success hover:bg-success/20",
  },
  {
    to: "/markets",
    icon: Eye,
    label_en: "Scan Markets",
    label_ar: "مسح الأسواق",
    desc_en: "Explore assets & opportunities",
    desc_ar: "استكشف الأصول والفرص",
    cls: "border-accent/30 bg-accent/10 text-accent hover:bg-accent/20",
  },
  {
    to: "/growth-plan",
    icon: Target,
    label_en: "Risk Review",
    label_ar: "فحص المخاطر",
    desc_en: "Growth plan & risk management",
    desc_ar: "خطة نمو وإدارة المخاطر",
    cls: "border-warning/30 bg-warning/10 text-warning hover:bg-warning/20",
  },
] as const;

function DashboardPage() {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const [cat, setCat] = useState<AssetCategory>("crypto");
  const [selected, setSelected] = useState<string | null>(null);

  const marketFn = useServerFn(getMarketData);
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["market"], queryFn: () => marketFn(), refetchInterval: 60000,
  });

  const filtered = useMemo(() => (data?.assets ?? []).filter((a) => a.category === cat), [data, cat]);
  const active = useMemo(() => filtered.find((a) => a.symbol === selected) ?? filtered[0], [filtered, selected]);
  const fmt = (n: number, dp = 2) => n?.toLocaleString(undefined, { maximumFractionDigits: dp }) ?? "—";
  const sig = useMemo(() => (active ? deriveSignal(active.history.map((p) => p.p)) : null), [active]);

  const saveSnapshot = async () => {
    if (!active || !user) return;
    const { error } = await supabase.from("market_archive").insert({
      user_id: user.id, symbol: active.symbol, asset_name: active.name, price: active.price,
      change_pct: active.changePct, high: active.high24h, low: active.low24h, volume: active.volume,
    });
    if (error) toast.error(error.message); else toast.success(t("saved"));
  };

  const ar = lang === "ar";

  return (
    <div className="container mx-auto max-w-7xl space-y-6 p-4 sm:p-6">

      {/* 1 ─ AI Strategic Hero */}
      <AIStrategicHero
        lang={lang}
        isFetching={isFetching}
        onRefresh={() => refetch()}
        assets={data?.assets ?? []}
        opportunities={topOpportunities}
      />

      {/* 2 ─ Portfolio KPIs */}
      <section>
        <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <Wallet className="h-3.5 w-3.5" />
          {ar ? "محفظتي" : "My portfolio"}
          <Badge variant="outline" className="ms-1 h-5 border-dashed text-[10px]">
            {ar ? "بيانات تجريبية" : "demo"}
          </Badge>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {portfolioKpis.map((k, i) => {
            const Icon = KPI_ICONS[i] ?? Activity;
            return (
              <Card key={i} className="gradient-card p-4 shadow-card hover-lift">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    {ar ? k.label_ar : k.label_en}
                  </span>
                  <span className={cn("grid h-8 w-8 place-items-center rounded-lg", TONE_CLS[k.tone])}>
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                </div>
                <div className="mt-2 font-display text-xl font-bold leading-tight">{k.value}</div>
                {k.change && (
                  <div
                    className={cn(
                      "mt-0.5 text-xs font-semibold",
                      k.change.startsWith("+") ? "text-success" : k.change.startsWith("-") ? "text-danger" : "text-muted-foreground",
                    )}
                  >
                    {k.change}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      </section>

      {/* 3 ─ Smart Market Pulse */}
      <SmartMarketPulse
        assets={data?.assets ?? []}
        lang={lang}
        isLoading={isLoading}
      />

      {/* 4 ─ Performance chart + AI Alerts */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="gradient-card p-5 shadow-card lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h3 className="font-display text-lg font-bold">
                {ar ? "أداء المحفظة (30 يوم)" : "Portfolio Performance (30d)"}
              </h3>
              <p className="text-xs text-muted-foreground">
                {ar ? "تقدير القيمة الإجمالية بالريال السعودي" : "Estimated total value (SAR)"}
              </p>
            </div>
            <Badge variant="outline" className="gap-1 border-success/40 text-success">
              <TrendingUp className="h-3 w-3" />+8.7%
            </Badge>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={portfolioPerformance}>
                <defs>
                  <linearGradient id="perfGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false}
                  tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                  formatter={(v: number) => [`${v.toLocaleString()} SAR`, ar ? "القيمة" : "Value"]}
                />
                <Area type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2.5} fill="url(#perfGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="gradient-card p-5 shadow-card">
          <div className="mb-3 flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary/15 text-primary">
              <Bell className="h-4 w-4" />
            </span>
            <div>
              <h3 className="font-display text-lg font-bold">
                {ar ? "تنبيهات ForeSmart AI" : "ForeSmart AI Alerts"}
              </h3>
              <p className="text-[11px] text-muted-foreground">
                {ar ? "بناءً على بيانات السوق اللحظية" : "Based on live market data"}
              </p>
            </div>
          </div>
          <div className="max-h-[18rem] space-y-2.5 overflow-auto pe-1">
            {aiAlerts.map((a) => (
              <div
                key={a.id}
                className={cn(
                  "rounded-lg border p-3 text-sm",
                  a.tone === "success" && "border-success/30 bg-success/5",
                  a.tone === "danger"  && "border-danger/30 bg-danger/5",
                  a.tone === "warning" && "border-warning/30 bg-warning/5",
                  a.tone === "primary" && "border-primary/30 bg-primary/5",
                )}
              >
                <div className="font-semibold">{ar ? a.title_ar : a.title_en}</div>
                <p className="mt-0.5 text-xs text-muted-foreground">{ar ? a.body_ar : a.body_en}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* 5 ─ Decision Center */}
      <DecisionCenter opportunities={topOpportunities} lang={lang} />

      {/* 6 ─ Portfolio Intelligence */}
      <section>
        <div className="mb-3 flex items-center gap-2">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-success/15 text-success">
            <PieChart className="h-4 w-4" />
          </span>
          <div>
            <h3 className="font-display text-lg font-bold leading-tight">
              {ar ? "ذكاء المحفظة" : "Portfolio Intelligence"}
            </h3>
            <p className="text-[11px] text-muted-foreground">
              {ar ? "تقييم AI للتعرض والتوزيع والمخاطر" : "AI assessment of exposure, allocation & risk"}
            </p>
          </div>
          <Badge variant="outline" className="ms-auto h-5 border-dashed text-[10px]">
            {ar ? "بيانات تجريبية" : "demo"}
          </Badge>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {/* Summary + AI Assessment */}
          <Card className="gradient-card p-5 shadow-card">
            <div className="mb-4 flex flex-wrap gap-x-6 gap-y-3 border-b border-border/40 pb-4">
              {portfolioKpis.slice(0, 3).map((k) => (
                <div key={k.label_en}>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    {ar ? k.label_ar : k.label_en}
                  </div>
                  <div className={cn(
                    "mt-0.5 font-display text-base font-bold leading-tight",
                    k.tone === "success" ? "text-success" : k.tone === "primary" ? "text-primary" : "text-foreground",
                  )}>
                    {k.value}
                  </div>
                  {k.change && (
                    <div className={cn(
                      "mt-0.5 text-[10px] font-semibold",
                      k.change.startsWith("+") ? "text-success" : k.change.startsWith("-") ? "text-danger" : "text-muted-foreground",
                    )}>
                      {k.change}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-3">
              <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold text-primary">
                <Brain className="h-3.5 w-3.5" />
                {ar ? "تقييم AI" : "AI Assessment"}
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">
                {ar
                  ? "تعرض متوازن متعدد الأصول مع ملف مخاطر معتدل. وزن الأسهم السعودية (32%) يمثل مركزك الرئيسي — يُنصح بمراقبة التركيز القطاعي. التعرض للعملات الرقمية (12%) ضمن الحدود المقبولة في ظل التذبذب الحالي."
                  : "Balanced multi-asset exposure with moderate risk profile. Saudi equity weight (32%) is your dominant position — monitor for sector concentration. Crypto exposure (12%) remains within acceptable bounds given current volatility."}
              </p>
            </div>
          </Card>

          {/* Allocation breakdown */}
          <Card className="gradient-card p-5 shadow-card">
            <h4 className="mb-4 font-display text-sm font-bold text-muted-foreground uppercase tracking-wider">
              {ar ? "توزيع الأصول" : "Asset Allocation"}
            </h4>
            <div className="space-y-3">
              {portfolioAllocation.map((slice) => (
                <div key={slice.label_en}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <span
                        className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm"
                        style={{ backgroundColor: slice.color }}
                      />
                      <span className="font-medium">
                        {ar ? slice.label_ar : slice.label_en}
                      </span>
                    </div>
                    <span className="font-bold tabular-nums">{slice.value}%</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted/30">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${slice.value}%`, backgroundColor: slice.color }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </section>

      {/* 7 ─ Quick AI Actions */}
      <section>
        <div className="mb-3 flex items-center gap-2">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/15 text-primary">
            <Zap className="h-4 w-4" />
          </span>
          <h3 className="font-display text-lg font-bold">
            {ar ? "إجراءات AI السريعة" : "Quick AI Actions"}
          </h3>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {QUICK_ACTIONS.map((a) => (
            <Link
              key={a.to}
              to={a.to}
              className={cn(
                "hover-lift flex flex-col gap-2 rounded-xl border p-4 transition-colors shadow-card",
                a.cls,
              )}
            >
              <a.icon className="h-5 w-5 shrink-0" />
              <div>
                <div className="text-sm font-bold leading-tight">
                  {ar ? a.label_ar : a.label_en}
                </div>
                <div className="mt-0.5 text-[11px] opacity-70">
                  {ar ? a.desc_ar : a.desc_en}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* 8 ─ Live Market Explorer */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-xl gradient-card border border-border p-5 shadow-card lg:col-span-2">
          {isLoading || !active ? (
            <div className="grid h-80 place-items-center text-muted-foreground">{t("loading")}</div>
          ) : (
            <>
              <PriceChart asset={active} />
              {sig && (
                <div className="mt-4 flex items-center justify-between rounded-lg border border-border bg-muted/40 p-4">
                  <div>
                    <div className="text-xs text-muted-foreground">{t("signal")}</div>
                    <div
                      className={cn(
                        "font-display text-xl font-bold",
                        sig.signal === "buy"  && "text-success",
                        sig.signal === "sell" && "text-danger",
                        sig.signal === "hold" && "text-warning",
                      )}
                    >
                      {t(sig.signal)}
                    </div>
                  </div>
                  <div className="text-end text-xs text-muted-foreground">
                    <div>{t("rsi")}: <span className="font-medium text-foreground">{sig.rsi?.toFixed(1) ?? "—"}</span></div>
                    <div>{t("sma")}: <span className="font-medium text-foreground">{sig.sma ? fmt(sig.sma, 4) : "—"}</span></div>
                  </div>
                  <Button size="sm" variant="outline" onClick={saveSnapshot}>
                    <Save className="me-2 h-4 w-4" /> {t("snapshot")}
                  </Button>
                </div>
              )}
            </>
          )}
        </div>

        <div className="rounded-xl gradient-card border border-border p-5 shadow-card">
          <Tabs value={cat} onValueChange={(v) => { setCat(v as AssetCategory); setSelected(null); }}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="crypto">{t("crypto")}</TabsTrigger>
              <TabsTrigger value="metals">{t("metals")}</TabsTrigger>
              <TabsTrigger value="currencies">{t("currencies")}</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="mt-3 max-h-96 space-y-1 overflow-auto pe-1">
            {filtered.map((a: AssetQuote) => (
              <button
                key={a.symbol}
                onClick={() => setSelected(a.symbol)}
                className={cn(
                  "flex w-full items-center justify-between rounded-lg p-3 text-start transition-colors",
                  active?.symbol === a.symbol ? "bg-primary/15 ring-1 ring-primary/40" : "hover:bg-muted/50",
                )}
              >
                <div>
                  <div className="text-sm font-semibold">{a.symbol}</div>
                  <div className="max-w-[120px] truncate text-xs text-muted-foreground">{a.name}</div>
                </div>
                <div className="text-end">
                  <div className="text-sm font-medium">{fmt(a.price, 4)}</div>
                  <div className={cn("text-xs", a.changePct >= 0 ? "text-success" : "text-danger")}>
                    {a.changePct >= 0 ? "+" : ""}{a.changePct.toFixed(2)}%
                  </div>
                </div>
              </button>
            ))}
            {!isLoading && filtered.length === 0 && (
              <div className="py-8 text-center text-sm text-muted-foreground">—</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
