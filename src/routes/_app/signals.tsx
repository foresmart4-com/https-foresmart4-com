import { ErrorBoundary } from "@/components/ErrorBoundary";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { generateSignals, type TradeSignal } from "@/lib/signals.functions";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sparkles, TrendingUp, TrendingDown, Eye, Pause,
  Activity, Target, ShieldAlert, Flame, Clock, RefreshCw, Brain,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/signals")({
  component: () => <ErrorBoundary fallbackTitle="تعذر تحميل الإشارات"><SignalsPage /></ErrorBoundary>,
  head: () => ({
    meta: [
      { title: "Trading Signals — ForeSmart" },
      { name: "description", content: "AI trading signals combining RSI, MACD and Bollinger with sentiment for short, medium and long-term horizons." },
      { property: "og:title", content: "Trading Signals — ForeSmart" },
      { property: "og:description", content: "AI signals across short, medium and long-term horizons." },
      { property: "og:url", content: "https://foresmart4.store/signals" },
    ],
    links: [{ rel: "canonical", href: "https://foresmart4.store/signals" }],
  }),
});

type FilterAction = "all" | "buy" | "sell" | "watch" | "hold";
type FilterHorizon = "all" | "short" | "medium" | "long";

function SignalsPage() {
  const { lang } = useI18n();
  const fn = useServerFn(generateSignals);
  const [signals, setSignals] = useState<TradeSignal[]>([]);
  const [generatedAt, setGeneratedAt] = useState<number | null>(null);
  const [actionFilter, setActionFilter] = useState<FilterAction>("all");
  const [horizonFilter, setHorizonFilter] = useState<FilterHorizon>("all");

  const mut = useMutation({
    mutationFn: () => fn(),
    onSuccess: (d) => {
      const sigs = Array.isArray(d?.signals) ? d.signals : [];
      setSignals(sigs);
      setGeneratedAt(d?.generatedAt ?? Date.now());
      toast.success(lang === "ar" ? `تم توليد ${sigs.length} إشارة` : `Generated ${sigs.length} signals`);
    },
    onError: () => toast.error(lang === "ar" ? "فشل توليد الإشارات" : "Failed to generate"),
  });

  const filtered = useMemo(() => {
    return signals.filter((s) =>
      (actionFilter === "all" || s.action === actionFilter) &&
      (horizonFilter === "all" || s.horizon === horizonFilter),
    );
  }, [signals, actionFilter, horizonFilter]);

  const stats = useMemo(() => {
    const buy = signals.filter((s) => s.action === "buy").length;
    const sell = signals.filter((s) => s.action === "sell").length;
    const watch = signals.filter((s) => s.action === "watch").length;
    const avgConf = signals.length ? Math.round(signals.reduce((a, s) => a + s.confidence, 0) / signals.length) : 0;
    return { buy, sell, watch, avgConf };
  }, [signals]);

  return (
    <div className="container mx-auto max-w-7xl p-6">
      {/* Hero */}
      <div className="relative mb-6 overflow-hidden rounded-2xl border border-border gradient-card p-6 shadow-card">
        <div className="absolute -top-16 -end-16 h-48 w-48 rounded-full bg-primary/15 blur-3xl" />
        <div className="absolute -bottom-20 -start-10 h-56 w-56 rounded-full bg-accent/10 blur-3xl" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl gradient-primary shadow-glow">
              <Brain className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
                <Sparkles className="h-3.5 w-3.5" />
                {lang === "ar" ? "محرك الإشارات الذكي" : "AI Signal Engine"}
              </div>
              <h1 className="mt-1 font-display text-3xl font-bold sm:text-4xl">
                <span className="text-gradient">{lang === "ar" ? "إشارات السوق" : "Market Signals"}</span>
              </h1>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                {lang === "ar"
                  ? "تحليل فني متقدم (RSI, MACD, بولينجر, متوسطات) مدمج مع تحليل معنويات السوق بالذكاء الاصطناعي."
                  : "Advanced technical analysis (RSI, MACD, Bollinger, MAs) fused with AI sentiment scoring."}
              </p>
            </div>
          </div>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending} className="gradient-primary text-primary-foreground shadow-glow">
            <RefreshCw className={cn("me-2 h-4 w-4", mut.isPending && "animate-spin")} />
            {mut.isPending
              ? (lang === "ar" ? "جارٍ التحليل..." : "Analyzing...")
              : (lang === "ar" ? "توليد إشارات" : "Generate Signals")}
          </Button>
        </div>
      </div>

      {/* Stats */}
      {signals.length > 0 && (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard icon={TrendingUp} label={lang === "ar" ? "شراء" : "Buy"} value={stats.buy} tone="success" />
          <StatCard icon={TrendingDown} label={lang === "ar" ? "بيع" : "Sell"} value={stats.sell} tone="danger" />
          <StatCard icon={Eye} label={lang === "ar" ? "مراقبة" : "Watch"} value={stats.watch} tone="primary" />
          <StatCard icon={Flame} label={lang === "ar" ? "متوسط الثقة" : "Avg confidence"} value={`${stats.avgConf}%`} tone="warning" />
        </div>
      )}

      {/* Filters */}
      {signals.length > 0 && (
        <div className="mb-5 flex flex-wrap gap-2">
          <FilterGroup
            label={lang === "ar" ? "الإجراء" : "Action"}
            value={actionFilter}
            options={[
              { v: "all", l: lang === "ar" ? "الكل" : "All" },
              { v: "buy", l: lang === "ar" ? "شراء" : "Buy" },
              { v: "sell", l: lang === "ar" ? "بيع" : "Sell" },
              { v: "watch", l: lang === "ar" ? "مراقبة" : "Watch" },
              { v: "hold", l: lang === "ar" ? "احتفاظ" : "Hold" },
            ]}
            onChange={(v) => setActionFilter(v as FilterAction)}
          />
          <FilterGroup
            label={lang === "ar" ? "المدى" : "Horizon"}
            value={horizonFilter}
            options={[
              { v: "all", l: lang === "ar" ? "الكل" : "All" },
              { v: "short", l: lang === "ar" ? "قصير" : "Short" },
              { v: "medium", l: lang === "ar" ? "متوسط" : "Medium" },
              { v: "long", l: lang === "ar" ? "طويل" : "Long" },
            ]}
            onChange={(v) => setHorizonFilter(v as FilterHorizon)}
          />
        </div>
      )}

      {/* Empty/loading state */}
      {!signals.length && !mut.isPending && (
        <div className="grid place-items-center rounded-2xl border border-dashed border-border bg-muted/20 p-12 text-center">
          <Activity className="mb-3 h-10 w-10 text-muted-foreground" />
          <p className="font-display text-lg">{lang === "ar" ? "لا توجد إشارات بعد" : "No signals yet"}</p>
          <p className="mt-1 text-sm text-muted-foreground">{lang === "ar" ? "اضغط زر التوليد لتحليل السوق الآن" : "Click generate to analyze the market"}</p>
        </div>
      )}

      {mut.isPending && !signals.length && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-64 animate-pulse rounded-2xl bg-muted/40" />
          ))}
        </div>
      )}

      {/* Signal grid */}
      {filtered.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((s, i) => <SignalCard key={`${s.symbol}-${i}`} s={s} lang={lang} />)}
        </div>
      )}

      {generatedAt && (
        <p className="mt-6 text-center text-xs text-muted-foreground">
          {lang === "ar" ? "آخر تحديث:" : "Last update:"} {new Date(generatedAt).toLocaleTimeString(lang === "ar" ? "ar-SA" : "en-US")}
        </p>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, tone }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string | number; tone: "success" | "danger" | "primary" | "warning" }) {
  const toneCls = tone === "success" ? "text-success bg-success/10 ring-success/30"
    : tone === "danger" ? "text-danger bg-danger/10 ring-danger/30"
    : tone === "warning" ? "text-warning bg-warning/10 ring-warning/30"
    : "text-primary bg-primary/10 ring-primary/30";
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border gradient-card p-4 shadow-card">
      <span className={cn("grid h-10 w-10 place-items-center rounded-lg ring-1", toneCls)}>
        <Icon className="h-5 w-5" />
      </span>
      <div>
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="font-display text-xl font-bold">{value}</div>
      </div>
    </div>
  );
}

function FilterGroup<T extends string>({ label, value, options, onChange }: {
  label: string; value: T; options: { v: T; l: string }[]; onChange: (v: T) => void;
}) {
  return (
    <div className="flex items-center gap-1 rounded-full border border-border bg-muted/30 p-1">
      <span className="px-2 text-xs text-muted-foreground">{label}</span>
      {options.map((o) => (
        <button
          key={o.v}
          onClick={() => onChange(o.v)}
          className={cn(
            "rounded-full px-3 py-1 text-xs font-medium transition-colors",
            value === o.v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.l}
        </button>
      ))}
    </div>
  );
}

const actionMeta = {
  buy: { icon: TrendingUp, cls: "text-success bg-success/15 ring-success/30", bar: "bg-success", ar: "شراء", en: "Buy" },
  sell: { icon: TrendingDown, cls: "text-danger bg-danger/15 ring-danger/30", bar: "bg-danger", ar: "بيع", en: "Sell" },
  hold: { icon: Pause, cls: "text-warning bg-warning/15 ring-warning/30", bar: "bg-warning", ar: "احتفاظ", en: "Hold" },
  watch: { icon: Eye, cls: "text-primary bg-primary/15 ring-primary/30", bar: "bg-primary", ar: "مراقبة", en: "Watch" },
} as const;

const horizonMeta = {
  short: { ar: "قصير", en: "Short" },
  medium: { ar: "متوسط", en: "Medium" },
  long: { ar: "طويل", en: "Long" },
} as const;

function SignalCard({ s, lang }: { s: TradeSignal; lang: "ar" | "en" }) {
  const m = actionMeta[s.action];
  const Icon = m.icon;
  return (
    <article className="relative overflow-hidden rounded-2xl border border-border gradient-card p-5 shadow-card transition-shadow hover:shadow-glow">
      <div className={cn("absolute inset-x-0 top-0 h-1", m.bar)} />
      <header className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-display text-xl font-bold">{s.symbol}</span>
            <Badge variant="outline" className="text-[10px]">{lang === "ar" ? horizonMeta[s.horizon].ar : horizonMeta[s.horizon].en}</Badge>
          </div>
          <div className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{s.asset_name}</div>
        </div>
        <span className={cn("inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold ring-1", m.cls)}>
          <Icon className="h-3 w-3" />
          {lang === "ar" ? m.ar : m.en}
        </span>
      </header>

      {/* Confidence bar */}
      <div className="mt-4">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">{lang === "ar" ? "الثقة" : "Confidence"}</span>
          <span className="font-semibold">{s.confidence}%</span>
        </div>
        <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted/40">
          <div className={cn("h-full transition-all", m.bar)} style={{ width: `${s.confidence}%` }} />
        </div>
        <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
          <span>{lang === "ar" ? "فني" : "Tech"}: {s.technical_score > 0 ? "+" : ""}{s.technical_score}</span>
          <span>{lang === "ar" ? "معنويات" : "Sentiment"}: {s.sentiment_score > 0 ? "+" : ""}{s.sentiment_score}</span>
        </div>
      </div>

      {/* Levels */}
      <div className="mt-4 grid grid-cols-3 gap-2 text-center text-[11px]">
        <Lvl label={lang === "ar" ? "دخول" : "Entry"} value={s.entry_price} />
        <Lvl label={lang === "ar" ? "وقف" : "Stop"} value={s.stop_loss} icon={ShieldAlert} tone="danger" />
        <Lvl label={lang === "ar" ? "أهداف" : "Targets"} value={s.targets.map((t) => fmt(t)).join(" / ")} icon={Target} tone="success" raw />
      </div>

      {/* Rationale */}
      {s.rationale && (
        <div className="mt-4 rounded-lg border border-border/50 bg-muted/20 p-3">
          <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            <Activity className="h-3 w-3" />
            {lang === "ar" ? "المبررات" : "Rationale"}
          </div>
          <p className="mt-1 text-xs leading-relaxed text-foreground/90">{s.rationale}</p>
        </div>
      )}

      {/* Indicators */}
      {s.indicators?.rsi !== null && s.indicators?.rsi !== undefined && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {s.indicators.rsi !== null && (
            <Indicator label="RSI" v={Number(s.indicators.rsi).toFixed(0)} />
          )}
          {s.indicators.sma20 !== null && s.indicators.sma20 !== undefined && (
            <Indicator label="MA20" v={fmt(s.indicators.sma20 as number)} />
          )}
          {s.indicators.macd !== null && s.indicators.macd !== undefined && (
            <Indicator label="MACD" v={(s.indicators.macd as number).toFixed(2)} />
          )}
        </div>
      )}
    </article>
  );
}

function fmt(n: number): string {
  if (n > 1000) return n.toFixed(0);
  if (n > 10) return n.toFixed(2);
  return n.toFixed(4);
}

function Lvl({ label, value, icon: Icon, tone, raw }: { label: string; value: string | number; icon?: React.ComponentType<{ className?: string }>; tone?: "danger" | "success"; raw?: boolean }) {
  return (
    <div className="rounded-md border border-border/50 bg-muted/20 px-1.5 py-1">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={cn("mt-0.5 inline-flex items-center gap-1 font-medium", tone === "success" && "text-success", tone === "danger" && "text-danger")}>
        {Icon && <Icon className="h-3 w-3" />}
        {raw ? value : (typeof value === "number" ? fmt(value) : value)}
      </div>
    </div>
  );
}

function Indicator({ label, v }: { label: string; v: string }) {
  return (
    <span className="rounded border border-border/60 bg-background/40 px-1.5 py-0.5 text-[10px] text-muted-foreground">
      {label}: <span className="text-foreground">{v}</span>
    </span>
  );
}
