// Quant Intelligence Panel — institutional fintech UI for regime,
// multi-timeframe alignment, portfolio risk, confidence and backtest.
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Activity, Layers, ShieldCheck, Gauge, History,
  TrendingUp, TrendingDown, Minus, AlertTriangle,
} from "lucide-react";
import { ConfidenceBar, RiskHeat } from "@/components/dashboard/ConfidenceBar";
import type { MarketIntel } from "@/services/analysis";
import type { TimeframeReport } from "@/services/quant/multiTimeframeEngine";

function Section({
  icon: Icon, title, subtitle, accent = "primary", children,
}: {
  icon: typeof Activity; title: string; subtitle?: string;
  accent?: "primary" | "accent" | "warning" | "success" | "danger";
  children: React.ReactNode;
}) {
  const map: Record<string, string> = {
    primary: "bg-primary/15 text-primary",
    accent: "bg-accent/15 text-accent",
    warning: "bg-warning/15 text-warning",
    success: "bg-success/15 text-success",
    danger: "bg-danger/15 text-danger",
  };
  return (
    <Card className="border-border/50 bg-card/40 p-5 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.25)]">
      <div className="mb-3 flex items-center gap-2">
        <span className={cn("grid h-8 w-8 place-items-center rounded-lg", map[accent])}>
          <Icon className="h-4 w-4" />
        </span>
        <div>
          <h3 className="font-display text-base font-bold">{title}</h3>
          {subtitle && <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{subtitle}</p>}
        </div>
      </div>
      {children}
    </Card>
  );
}

function TrendIcon({ t }: { t: "up" | "down" | "flat" }) {
  if (t === "up") return <TrendingUp className="h-3 w-3 text-success" />;
  if (t === "down") return <TrendingDown className="h-3 w-3 text-danger" />;
  return <Minus className="h-3 w-3 text-muted-foreground" />;
}

function BiasBadge({ bias, ar }: { bias: "bullish" | "bearish" | "neutral"; ar: boolean }) {
  const map = {
    bullish: { c: "border-success/40 text-success bg-success/10", l: ar ? "صاعد" : "Bullish" },
    bearish: { c: "border-danger/40 text-danger bg-danger/10", l: ar ? "هابط" : "Bearish" },
    neutral: { c: "border-border/50 text-muted-foreground bg-muted/20", l: ar ? "محايد" : "Neutral" },
  } as const;
  const v = map[bias];
  return <span className={cn("rounded-md border px-1.5 py-0.5 text-[10px] font-bold", v.c)}>{v.l}</span>;
}

function TFRow({ r, ar }: { r: TimeframeReport; ar: boolean }) {
  return (
    <div className="rounded-lg border border-border/40 bg-muted/10 p-2.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold tracking-wider">{r.asset}</span>
          <span className="text-[11px] text-muted-foreground">{r.assetName}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <BiasBadge bias={r.shortBias} ar={ar} />
          <BiasBadge bias={r.macroBias} ar={ar} />
        </div>
      </div>
      <div className="mt-2 grid grid-cols-5 gap-1">
        {r.readings.map((x) => (
          <div key={x.tf} className={cn(
            "rounded border px-1 py-1 text-center",
            x.aligned === 1 ? "border-success/30 bg-success/5" :
            x.aligned === -1 ? "border-danger/30 bg-danger/5" :
            "border-border/40 bg-muted/10",
          )}>
            <div className="flex items-center justify-center gap-0.5 text-[10px] font-bold">
              {x.tf} <TrendIcon t={x.trend} />
            </div>
            <div className="text-[9px] text-muted-foreground tabular-nums">{x.strength.toFixed(0)}</div>
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center justify-between text-[10px] uppercase tracking-wider text-muted-foreground">
        <span>{ar ? "توافق" : "Agreement"}</span>
        <span className="font-bold text-primary">{r.agreement}%</span>
      </div>
      <ConfidenceBar value={r.agreement} />
    </div>
  );
}

export function QuantPanel({ data, ar }: { data: MarketIntel; ar: boolean }) {
  const { regime, timeframes, portfolio, confidence, backtest, calibratedSignals } = data;

  const regimeTone =
    regime.regime === "Panic" || regime.regime === "Trending Bearish" || regime.regime === "Risk-Off"
      ? "danger"
      : regime.regime === "High Volatility" ? "warning"
      : regime.regime === "Trending Bullish" || regime.regime === "Risk-On" ? "success"
      : "primary";

  const stabilityTone =
    confidence.stability === "stable" ? "text-success" :
    confidence.stability === "shaky" ? "text-warning" : "text-danger";

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-primary to-accent text-primary-foreground shadow-glow">
          <Layers className="h-4 w-4" />
        </span>
        <div>
          <h2 className="font-display text-lg font-bold">{ar ? "طبقة الذكاء الكمي" : "Quant Intelligence Layer"}</h2>
          <p className="text-[11px] text-muted-foreground">
            {ar ? "نظام مؤسسي للنظام السوقي والإطارات الزمنية والمحفظة" : "Institutional regime · multi-timeframe · portfolio analytics"}
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Regime panel */}
        <Section
          icon={Activity}
          title={ar ? "النظام السوقي" : "Market Regime"}
          subtitle={ar ? "تشخيص لحظي" : "Live diagnosis"}
          accent={regimeTone as any}
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="font-display text-xl font-bold">{regime.regime}</div>
              <div className="text-[11px] text-muted-foreground">{ar ? "ثقة" : "Confidence"} {regime.confidence}%</div>
            </div>
            <Badge variant="outline" className="border-primary/40 text-[10px]">
              σ {regime.metrics.avgVol} · M {regime.metrics.avgMomentum}
            </Badge>
          </div>
          <div className="mt-3"><ConfidenceBar value={regime.confidence} /></div>
          <p className="mt-3 text-xs text-muted-foreground">{regime.explanation}</p>
          <div className="mt-3 rounded-lg border border-primary/20 bg-primary/5 p-2.5">
            <div className="text-[10px] font-bold uppercase tracking-wider text-primary">
              {ar ? "تكيّف الاستراتيجية" : "Strategy adaptation"}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{regime.strategyHint}</p>
          </div>
        </Section>

        {/* Confidence meter */}
        <Section
          icon={Gauge}
          title={ar ? "مقياس الثقة الكمي" : "Quant Confidence Meter"}
          subtitle={ar ? "معايرة ديناميكية" : "Dynamic calibration"}
          accent="accent"
        >
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded border border-border/40 bg-muted/10 p-2 text-center">
              <div className="text-[10px] uppercase text-muted-foreground">{ar ? "خام" : "Raw"}</div>
              <div className="font-display text-lg font-bold tabular-nums">{confidence.averageRaw}</div>
            </div>
            <div className="rounded border border-primary/30 bg-primary/5 p-2 text-center">
              <div className="text-[10px] uppercase text-primary">{ar ? "معاير" : "Calibrated"}</div>
              <div className="font-display text-lg font-bold tabular-nums text-primary">{confidence.averageCalibrated}</div>
            </div>
            <div className="rounded border border-border/40 bg-muted/10 p-2 text-center">
              <div className="text-[10px] uppercase text-muted-foreground">{ar ? "شك" : "Uncert."}</div>
              <div className="font-display text-lg font-bold tabular-nums text-warning">{confidence.averageUncertainty}</div>
            </div>
          </div>
          <div className="mt-3">
            <ConfidenceBar value={confidence.averageCalibrated} />
          </div>
          <div className={cn("mt-3 text-xs font-semibold uppercase tracking-wider", stabilityTone)}>
            {ar ? "الاستقرار:" : "Stability:"} {confidence.stability}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{confidence.reasoning}</p>
        </Section>

        {/* Portfolio risk monitor */}
        <Section
          icon={ShieldCheck}
          title={ar ? "مراقب مخاطر المحفظة" : "Portfolio Risk Monitor"}
          subtitle={ar ? "تعرض وتركيز وارتباط" : "Exposure · concentration · correlation"}
          accent={portfolio.riskScore > 70 ? "danger" : portfolio.riskScore > 45 ? "warning" : "success"}
        >
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded border border-border/40 bg-muted/10 p-2">
              <div className="text-[10px] uppercase text-muted-foreground">{ar ? "تعرض" : "Exposure"}</div>
              <div className="font-display text-base font-bold tabular-nums">{portfolio.totalExposure}%</div>
            </div>
            <div className="rounded border border-border/40 bg-muted/10 p-2">
              <div className="text-[10px] uppercase text-muted-foreground">{ar ? "تركيز" : "Concentr."}</div>
              <div className="font-display text-base font-bold tabular-nums">{portfolio.concentration}</div>
            </div>
            <div className="rounded border border-border/40 bg-muted/10 p-2">
              <div className="text-[10px] uppercase text-muted-foreground">{ar ? "ارتباط" : "Corr. exp"}</div>
              <div className="font-display text-base font-bold tabular-nums">{portfolio.correlatedExposure}</div>
            </div>
          </div>
          <div className="mt-3">
            <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-wider text-muted-foreground">
              <span>{ar ? "نقاط المخاطر" : "Risk score"}</span>
              <span className="font-bold">{portfolio.riskScore}</span>
            </div>
            <RiskHeat value={portfolio.riskScore} />
          </div>
          <div className="mt-3 space-y-1.5">
            {portfolio.positions.slice(0, 4).map((p) => (
              <div key={p.asset} className="flex items-center justify-between text-[11px]">
                <span className="flex items-center gap-1.5">
                  <span className="rounded bg-muted/30 px-1.5 py-0.5 font-bold">{p.asset}</span>
                  <span className={cn(
                    p.bias === "long" ? "text-success" :
                    p.bias === "short" ? "text-danger" : "text-muted-foreground",
                  )}>{p.bias}</span>
                </span>
                <span className="tabular-nums text-muted-foreground">{Math.round(p.weight * 100)}%</span>
              </div>
            ))}
          </div>
          {portfolio.warnings.length > 0 && (
            <div className="mt-3 space-y-1">
              {portfolio.warnings.map((w, i) => (
                <div key={i} className="flex items-start gap-1.5 rounded border border-warning/30 bg-warning/5 p-1.5 text-[11px] text-warning">
                  <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" /><span>{w}</span>
                </div>
              ))}
            </div>
          )}
          {portfolio.diversificationSuggestions.length > 0 && (
            <ul className="mt-2 space-y-0.5 text-[11px] text-muted-foreground">
              {portfolio.diversificationSuggestions.slice(0, 3).map((s, i) => <li key={i}>· {s}</li>)}
            </ul>
          )}
        </Section>
      </div>

      {/* Multi-timeframe alignment */}
      <Section
        icon={Layers}
        title={ar ? "محاذاة الإطارات الزمنية" : "Multi-Timeframe Alignment"}
        subtitle="5m · 15m · 1h · 4h · 1D"
        accent="primary"
      >
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {timeframes.map((r) => <TFRow key={r.asset} r={r} ar={ar} />)}
        </div>
      </Section>

      {/* Signal performance tracker */}
      <Section
        icon={History}
        title={ar ? "تتبع أداء الإشارات" : "Signal Performance Tracker"}
        subtitle={ar ? "اختبار خلفي خفيف" : "Rolling backtest"}
        accent="accent"
      >
        <div className="mb-3 grid grid-cols-4 gap-2 text-center">
          <div className="rounded border border-border/40 bg-muted/10 p-2">
            <div className="text-[10px] uppercase text-muted-foreground">{ar ? "صفقات" : "Trades"}</div>
            <div className="font-display text-base font-bold tabular-nums">{backtest.overall.trades}</div>
          </div>
          <div className="rounded border border-success/30 bg-success/5 p-2">
            <div className="text-[10px] uppercase text-success">{ar ? "نسبة الفوز" : "Win rate"}</div>
            <div className="font-display text-base font-bold tabular-nums text-success">{backtest.overall.winRate}%</div>
          </div>
          <div className="rounded border border-border/40 bg-muted/10 p-2">
            <div className="text-[10px] uppercase text-muted-foreground">{ar ? "ثقة" : "Avg conf"}</div>
            <div className="font-display text-base font-bold tabular-nums">{backtest.overall.avgConfidence}</div>
          </div>
          <div className="rounded border border-primary/30 bg-primary/5 p-2">
            <div className="text-[10px] uppercase text-primary">{ar ? "النظام" : "Regime"}</div>
            <div className="font-display text-xs font-bold text-primary">{backtest.overall.regime}</div>
          </div>
        </div>
        <div className="overflow-hidden rounded-lg border border-border/40">
          <table className="w-full text-xs">
            <thead className="bg-muted/20 text-[10px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-2 py-1.5 text-start">{ar ? "الأصل" : "Asset"}</th>
                <th className="px-2 py-1.5 text-end">{ar ? "صفقات" : "Trades"}</th>
                <th className="px-2 py-1.5 text-end">{ar ? "فوز" : "Win %"}</th>
                <th className="px-2 py-1.5 text-end">{ar ? "ثقة" : "Conf"}</th>
                <th className="px-2 py-1.5 text-end">σ</th>
              </tr>
            </thead>
            <tbody>
              {backtest.perAsset.map((p) => (
                <tr key={p.asset} className="border-t border-border/30">
                  <td className="px-2 py-1.5 font-semibold">{p.asset} <span className="text-muted-foreground">· {p.assetName}</span></td>
                  <td className="px-2 py-1.5 text-end tabular-nums">{p.trades}</td>
                  <td className={cn(
                    "px-2 py-1.5 text-end font-bold tabular-nums",
                    p.winRate >= 60 ? "text-success" : p.winRate < 45 ? "text-danger" : "text-warning",
                  )}>{p.winRate}%</td>
                  <td className="px-2 py-1.5 text-end tabular-nums">{p.avgConfidence}</td>
                  <td className="px-2 py-1.5 text-end tabular-nums">{p.avgVolatility}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {backtest.observations.length > 0 && (
          <ul className="mt-3 space-y-0.5 text-[11px] text-muted-foreground">
            {backtest.observations.map((o, i) => <li key={i}>· {o}</li>)}
          </ul>
        )}
        {calibratedSignals.length > 0 && (
          <div className="mt-3 rounded-lg border border-border/40 bg-muted/10 p-2.5">
            <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              {ar ? "ملاحظات المعايرة" : "Calibration notes"}
            </div>
            <ul className="space-y-0.5 text-[11px] text-muted-foreground">
              {calibratedSignals
                .flatMap((c) => c.notes.map((n) => `${c.asset}: ${n}`))
                .slice(0, 5)
                .map((n, i) => <li key={i}>· {n}</li>)}
            </ul>
          </div>
        )}
      </Section>
    </section>
  );
}
