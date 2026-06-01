import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ConfidenceBar, RiskHeat } from "@/components/dashboard/ConfidenceBar";
import {
  Target, LogOut, Scale, Clock, Briefcase, ShieldAlert, TrendingUp, TrendingDown, Activity,
} from "lucide-react";
import type { MarketIntel } from "@/services/analysis";
import { patchAr } from "@/lib/aiTranslate";

function Panel({ className, children }: { className?: string; children?: React.ReactNode }) {
  return (
    <Card className={cn(
      "border-border/50 bg-card/40 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.25)]",
      "transition-all hover:border-primary/40", className,
    )}>{children}</Card>
  );
}

function BiasBadge({ bias }: { bias: "long" | "short" | "neutral" }) {
  const map = {
    long:    "bg-success/15 text-success border-success/30",
    short:   "bg-danger/15 text-danger border-danger/30",
    neutral: "bg-warning/15 text-warning border-warning/30",
  } as const;
  return <span className={cn("rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider", map[bias])}>{bias}</span>;
}

const QUALITY_AR: Record<string, string> = {
  excellent: "ممتاز",
  good: "جيد",
  fair: "مقبول",
  poor: "ضعيف",
};

function QualityChip({ q, ar = false }: { q: "excellent" | "good" | "fair" | "poor"; ar?: boolean }) {
  const tone =
    q === "excellent" ? "border-success/40 text-success" :
    q === "good"      ? "border-primary/40 text-primary" :
    q === "fair"      ? "border-warning/40 text-warning" :
                        "border-danger/40 text-danger";
  const label = ar ? (QUALITY_AR[q] ?? q) : q;
  return <Badge variant="outline" className={cn("text-[10px]", tone)}>{label}</Badge>;
}

function RecChip({ r }: { r: "execute-now" | "scale-in" | "wait" | "stand-aside" }) {
  const tone =
    r === "execute-now" ? "border-success/40 text-success bg-success/10" :
    r === "scale-in"    ? "border-primary/40 text-primary bg-primary/10" :
    r === "wait"        ? "border-warning/40 text-warning bg-warning/10" :
                          "border-danger/40 text-danger bg-danger/10";
  return <span className={cn("rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase", tone)}>{r.replace("-", " ")}</span>;
}

function fmt(n: number): string {
  if (n >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (n >= 10) return n.toFixed(2);
  return n.toFixed(4);
}

export function TacticalExecutionPanel({ data, ar }: { data: MarketIntel; ar: boolean }) {
  const plans = data.tradePlans.slice(0, 4);
  const entries = data.entryZones.slice(0, 5);
  const exits = data.exitPlans.slice(0, 5);
  const sizings = data.positionSizing.slice(0, 5);
  const timings = data.timingReports.slice(0, 5);

  return (
    <section className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-primary to-accent text-primary-foreground shadow-glow">
          <Briefcase className="h-4 w-4" />
        </span>
        <div>
          <h2 className="font-display text-lg font-bold leading-tight">
            {ar ? "ذكاء التنفيذ التكتيكي" : "Tactical Execution Intelligence"}
          </h2>
          <p className="text-[11px] text-muted-foreground">
            {ar ? "خطط مؤسسية: دخول، خروج، حجم، توقيت" : "Institutional plans · entry · exit · sizing · timing"}
          </p>
        </div>
      </div>

      {/* 1 — Tactical Trade Planner */}
      <Panel className="p-5">
        <div className="mb-3 flex items-center gap-2">
          <Briefcase className="h-4 w-4 text-primary" />
          <h3 className="font-display text-base font-bold">{ar ? "خطة التداول التكتيكية" : "Tactical Trade Planner"}</h3>
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          {plans.map((p) => (
            <div key={p.asset} className="rounded-lg border border-border/40 bg-muted/10 p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold">{p.asset}</span>
                  <span className="text-[11px] text-muted-foreground">{p.assetName}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <BiasBadge bias={p.bias} />
                  <Badge variant="outline" className="text-[10px] border-accent/40">{p.riskProfile}</Badge>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-[11px]">
                <div className="rounded-md border border-border/30 bg-background/30 p-2">
                  <div className="text-muted-foreground">{ar ? "دخول" : "Entry"}</div>
                  <div className="font-mono tabular-nums">{fmt(p.entry.optimal)}</div>
                </div>
                <div className="rounded-md border border-border/30 bg-background/30 p-2">
                  <div className="text-muted-foreground">{ar ? "هدف" : "TP1"}</div>
                  <div className="font-mono tabular-nums">{fmt(p.exit.takeProfit[0])}</div>
                </div>
                <div className="rounded-md border border-border/30 bg-background/30 p-2">
                  <div className="text-muted-foreground">{ar ? "وقف" : "Stop"}</div>
                  <div className="font-mono tabular-nums">{fmt(p.exit.defensiveStop)}</div>
                </div>
              </div>
              <div className="mt-2 flex items-center justify-between text-[11px]">
                <span className="text-muted-foreground">{ar ? "ثقة" : "Conf"} {p.confidence}%</span>
                <RecChip r={p.timing.recommendation} />
              </div>
              <ConfidenceBar value={p.confidence} className="mt-1.5" />
              <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">{patchAr(p.reasoning, ar)}</p>
              <p className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground/70">{patchAr(p.regimeContext, ar)}</p>
            </div>
          ))}
        </div>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* 2 — Entry Zone Intelligence */}
        <Panel className="p-5">
          <div className="mb-3 flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" />
            <h3 className="font-display text-base font-bold">{ar ? "مناطق الدخول الذكية" : "Entry Zone Intelligence"}</h3>
          </div>
          <div className="space-y-2">
            {entries.map((e) => (
              <div key={e.asset} className="rounded-lg border border-border/40 bg-muted/10 p-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold">{e.asset}</span>
                    <BiasBadge bias={e.bias} />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <QualityChip q={e.quality} ar={ar} />
                    <span className="text-[10px] text-muted-foreground">{ar ? "توقيت" : "T"} {e.timing}</span>
                  </div>
                </div>
                <div className="mt-1.5 grid grid-cols-3 gap-1.5 text-[11px]">
                  <div className="rounded border border-success/20 bg-success/5 p-1.5">
                    <div className="text-[9px] uppercase text-success/80">{ar ? "متحفظ" : "Cons."}</div>
                    <div className="font-mono tabular-nums">{fmt(e.conservative)}</div>
                  </div>
                  <div className="rounded border border-primary/30 bg-primary/5 p-1.5">
                    <div className="text-[9px] uppercase text-primary/90">{ar ? "أمثل" : "Opt."}</div>
                    <div className="font-mono tabular-nums">{fmt(e.optimal)}</div>
                  </div>
                  <div className="rounded border border-warning/20 bg-warning/5 p-1.5">
                    <div className="text-[9px] uppercase text-warning/80">{ar ? "جريء" : "Agg."}</div>
                    <div className="font-mono tabular-nums">{fmt(e.aggressive)}</div>
                  </div>
                </div>
                <ConfidenceBar value={e.confidence} className="mt-1.5" />
              </div>
            ))}
          </div>
        </Panel>

        {/* 3 — Exit Strategy Panel */}
        <Panel className="p-5">
          <div className="mb-3 flex items-center gap-2">
            <LogOut className="h-4 w-4 text-accent" />
            <h3 className="font-display text-base font-bold">{ar ? "إستراتيجية الخروج" : "Exit Strategy"}</h3>
          </div>
          <div className="space-y-2">
            {exits.map((x) => (
              <div key={x.asset} className="rounded-lg border border-border/40 bg-muted/10 p-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold">{x.asset}</span>
                    <BiasBadge bias={x.bias} />
                  </div>
                  <span className="text-[10px] text-muted-foreground">
                    {ar ? "إرهاق" : "Exhaust."} {x.exhaustionRisk}
                  </span>
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px]">
                  {x.takeProfit.map((tp, i) => (
                    <span key={i} className="rounded border border-success/30 bg-success/5 px-1.5 py-0.5 font-mono tabular-nums text-success">
                      TP{i + 1} {fmt(tp)}
                    </span>
                  ))}
                  <span className="rounded border border-danger/30 bg-danger/5 px-1.5 py-0.5 font-mono tabular-nums text-danger">
                    SL {fmt(x.defensiveStop)}
                  </span>
                  <span className="rounded border border-primary/30 bg-primary/5 px-1.5 py-0.5 font-mono tabular-nums text-primary">
                    {ar ? "متابعة" : "Trail"} {fmt(x.trailingTrigger)} · {x.trailingDistancePct}%
                  </span>
                </div>
                <RiskHeat value={x.exhaustionRisk} className="mt-1.5" />
              </div>
            ))}
          </div>
        </Panel>

        {/* 4 — Position Risk Monitor */}
        <Panel className="p-5">
          <div className="mb-3 flex items-center gap-2">
            <Scale className="h-4 w-4 text-warning" />
            <h3 className="font-display text-base font-bold">{ar ? "مراقب حجم المخاطر" : "Position Risk Monitor"}</h3>
          </div>
          <div className="space-y-2">
            {sizings.map((s) => {
              const tone =
                s.exposureWarning === "critical" ? "text-danger" :
                s.exposureWarning === "elevated" ? "text-warning" :
                s.exposureWarning === "moderate" ? "text-primary" : "text-success";
              return (
                <div key={s.asset} className="rounded-lg border border-border/40 bg-muted/10 p-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold">{s.asset}</span>
                    <span className={cn("flex items-center gap-1 text-[10px] uppercase tracking-wider", tone)}>
                      <ShieldAlert className="h-3 w-3" /> {s.exposureWarning}
                    </span>
                  </div>
                  <div className="mt-1 grid grid-cols-3 gap-2 text-[11px]">
                    <div>
                      <div className="text-[9px] uppercase text-muted-foreground">{ar ? "مقترح" : "Suggested"}</div>
                      <div className="font-mono tabular-nums">{s.suggestedSizePct}%</div>
                    </div>
                    <div>
                      <div className="text-[9px] uppercase text-muted-foreground">{ar ? "معدّل" : "Risk-Adj"}</div>
                      <div className="font-mono tabular-nums">{s.riskAdjustedPct}%</div>
                    </div>
                    <div>
                      <div className="text-[9px] uppercase text-muted-foreground">{ar ? "حذر" : "Caution"}</div>
                      <div className="font-mono tabular-nums">{s.cautionScore}</div>
                    </div>
                  </div>
                  <RiskHeat value={s.cautionScore} className="mt-1.5" />
                  <p className="mt-1.5 text-[11px] text-muted-foreground">{patchAr(s.rationale, ar)}</p>
                </div>
              );
            })}
          </div>
        </Panel>

        {/* 5 — Execution Timing Quality */}
        <Panel className="p-5">
          <div className="mb-3 flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" />
            <h3 className="font-display text-base font-bold">{ar ? "جودة التوقيت التنفيذي" : "Execution Timing Quality"}</h3>
          </div>
          <div className="space-y-2">
            {timings.map((t) => {
              const goodBias = t.executionQuality >= 55;
              return (
                <div key={t.asset} className="rounded-lg border border-border/40 bg-muted/10 p-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold">{t.asset}</span>
                      {goodBias
                        ? <TrendingUp className="h-3 w-3 text-success" />
                        : <TrendingDown className="h-3 w-3 text-danger" />}
                    </div>
                    <RecChip r={t.recommendation} />
                  </div>
                  <div className="mt-1.5 grid grid-cols-3 gap-1.5 text-[10px]">
                    <div className="rounded border border-border/30 bg-background/30 p-1.5">
                      <div className="text-muted-foreground">{ar ? "جودة" : "Quality"}</div>
                      <div className="font-mono tabular-nums">{t.executionQuality}</div>
                    </div>
                    <div className="rounded border border-border/30 bg-background/30 p-1.5">
                      <div className="text-muted-foreground">{ar ? "مخاطر" : "Risk"}</div>
                      <div className="font-mono tabular-nums">{t.timingRisk}</div>
                    </div>
                    <div className="rounded border border-border/30 bg-background/30 p-1.5">
                      <div className="text-muted-foreground">{ar ? "ضوضاء" : "Noise"}</div>
                      <div className="font-mono tabular-nums">{t.factors.noise}</div>
                    </div>
                  </div>
                  <ConfidenceBar value={t.executionQuality} className="mt-1.5" />
                  <p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Activity className="h-3 w-3" /> {patchAr(t.note, ar)}
                  </p>
                </div>
              );
            })}
          </div>
        </Panel>
      </div>
    </section>
  );
}
