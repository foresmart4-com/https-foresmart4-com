// Adaptive Intelligence Panel — adds 5 new learning sections to the AI dashboard:
// AI Learning Monitor, Signal Memory Timeline, Strategy Adaptation, Asset Personality,
// AI Self-Evaluation. All computations are client-side & memoized per intel snapshot.
import { useEffect, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import {
  Brain, History, Compass, Fingerprint, Activity, TrendingUp, TrendingDown,
  ShieldCheck, AlertTriangle,
} from "lucide-react";
import type { MarketIntel } from "@/services/analysis";
import { recordSignals, computeStats, getMemory } from "@/services/learning/signalMemory";
import { patchAr } from "@/lib/aiTranslate";
import { buildPerformanceLearning } from "@/services/learning/performanceLearning";
import { adaptStrategy } from "@/services/learning/strategyAdaptation";
import { profileAll, type AssetPersonality } from "@/services/learning/assetPersonality";
import { evaluateSelf } from "@/services/learning/selfEvaluation";

interface Props { data: MarketIntel; ar: boolean }

function Panel({ icon, title, subtitle, children, className }: {
  icon: React.ReactNode; title: string; subtitle?: string;
  children: React.ReactNode; className?: string;
}) {
  return (
    <Card className={cn(
      "border-border/50 bg-card/40 p-5 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.25)]",
      "transition-all hover:border-primary/40", className,
    )}>
      <div className="mb-4 flex items-center gap-2">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary/15 text-primary">{icon}</span>
        <div>
          <h3 className="font-display text-lg font-bold">{title}</h3>
          {subtitle && <p className="text-[11px] text-muted-foreground">{subtitle}</p>}
        </div>
      </div>
      {children}
    </Card>
  );
}

function StatTile({ label, value, suffix, tone }: { label: string; value: number | string; suffix?: string; tone?: "good" | "bad" | "warn" | "neutral" }) {
  const toneCls = tone === "good" ? "text-success" : tone === "bad" ? "text-danger" : tone === "warn" ? "text-warning" : "text-foreground";
  return (
    <div className="rounded-lg border border-border/40 bg-muted/10 p-2.5">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={cn("mt-0.5 font-mono text-base font-bold tabular-nums", toneCls)}>
        {value}{suffix ?? ""}
      </div>
    </div>
  );
}

function archetypeTone(a: AssetPersonality["archetype"]): string {
  switch (a) {
    case "trend-follower": return "border-success/40 text-success";
    case "mean-reverter": return "border-primary/40 text-primary";
    case "volatile-mover": return "border-danger/40 text-danger";
    case "stable-anchor": return "border-muted-foreground/30 text-muted-foreground";
    default: return "border-warning/40 text-warning";
  }
}

export function AdaptiveIntelligencePanel({ data, ar }: Props) {
  // Record signals into memory whenever a fresh intel snapshot arrives.
  useEffect(() => {
    recordSignals(data.signals, data.quotes, data.regime, data.sentiment);
  }, [data.generatedAt, data.signals, data.quotes, data.regime, data.sentiment]);

  const stats = useMemo(() => computeStats(), [data.generatedAt]);
  const memory = useMemo(() => getMemory().slice(-12).reverse(), [data.generatedAt]);
  const learning = useMemo(() => buildPerformanceLearning(), [data.generatedAt]);
  const avgVol = useMemo(
    () => (data.quotes.length ? data.quotes.reduce((s, q) => s + q.volatility, 0) / data.quotes.length : 0),
    [data.quotes],
  );
  const adaptation = useMemo(
    () => adaptStrategy(data.regime, data.sentiment, avgVol),
    [data.regime, data.sentiment, avgVol],
  );
  const personalities = useMemo(() => profileAll(data.quotes), [data.quotes]);
  const selfEval = useMemo(
    () => evaluateSelf(data.signals, data.calibratedSignals, data.regime, learning),
    [data.signals, data.calibratedSignals, data.regime, learning],
  );

  const healthTone: "good" | "warn" | "bad" =
    selfEval.systemHealth >= 70 ? "good" : selfEval.systemHealth >= 50 ? "warn" : "bad";

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-primary to-accent text-primary-foreground shadow-glow">
          <Brain className="h-4 w-4" />
        </span>
        <div>
          <h2 className="font-display text-xl font-bold">
            {ar ? "طبقة الذكاء التكيفي" : "Adaptive Intelligence Layer"}
          </h2>
          <p className="text-[11px] text-muted-foreground">
            {ar
              ? "تعلم مستمر، تكيّف الاستراتيجية، شخصية الأصول وتقييم ذاتي"
              : "Continuous learning, strategy adaptation, asset personality & self-evaluation"}
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* AI Learning Monitor */}
        <Panel
          icon={<Activity className="h-4 w-4" />}
          title={ar ? "مراقب التعلم" : "AI Learning Monitor"}
          subtitle={patchAr(learning.hint, ar)}
        >
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <StatTile label={ar ? "عينات" : "Samples"} value={stats.evaluated} />
            <StatTile label={ar ? "نسبة النجاح" : "Win Rate"} value={stats.winRate} suffix="%"
              tone={stats.winRate >= 60 ? "good" : stats.winRate >= 45 ? "warn" : stats.evaluated ? "bad" : "neutral"} />
            <StatTile label={ar ? "ثقة عالية" : "High Conf"} value={learning.highConfAccuracy} suffix="%"
              tone={learning.highConfAccuracy >= 65 ? "good" : "warn"} />
            <StatTile label={ar ? "اختراق زائف" : "False Brk"} value={learning.falseBreakoutRate} suffix="%"
              tone={learning.falseBreakoutRate >= 50 ? "bad" : "neutral"} />
          </div>

          {learning.observations.length > 0 && (
            <div className="mt-3 space-y-1.5">
              {learning.observations.slice(0, 4).map((o, i) => (
                <div key={i} className="flex items-start gap-2 rounded-md border border-border/30 bg-muted/10 p-2 text-[11px]">
                  <Badge variant="outline" className={cn(
                    "shrink-0 text-[9px] uppercase",
                    o.kind === "strength" ? "border-success/40 text-success" :
                    o.kind === "weakness" ? "border-danger/40 text-danger" :
                    o.kind === "calibration" ? "border-warning/40 text-warning" :
                    "border-primary/40 text-primary",
                  )}>{o.kind}</Badge>
                  <span className="text-muted-foreground">{o.message}</span>
                </div>
              ))}
            </div>
          )}

          {learning.modifiers.length > 0 && (
            <div className="mt-3">
              <div className="mb-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                {ar ? "معدّلات الثقة التكيفية" : "Adaptive Confidence Modifiers"}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {learning.modifiers.slice(0, 6).map((m, i) => (
                  <Badge key={i} variant="outline" className={cn(
                    "font-mono text-[10px]",
                    m.delta > 0 ? "border-success/40 text-success" : "border-danger/40 text-danger",
                  )} title={m.reason}>
                    {m.asset ?? m.regime ?? m.volBucket} {m.delta > 0 ? "+" : ""}{m.delta}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </Panel>

        {/* Signal Memory Timeline */}
        <Panel
          icon={<History className="h-4 w-4" />}
          title={ar ? "ذاكرة الإشارات" : "Signal Memory Timeline"}
          subtitle={ar ? `أحدث ${memory.length} إشارة` : `Last ${memory.length} recorded signals`}
        >
          {memory.length === 0 ? (
            <div className="rounded-md border border-dashed border-border/40 p-4 text-center text-xs text-muted-foreground">
              {ar ? "جارٍ بناء الذاكرة..." : "Collecting signal history..."}
            </div>
          ) : (
            <div className="max-h-[280px] space-y-1.5 overflow-y-auto pe-1">
              {memory.map((e) => {
                const upDir = e.action === "BUY";
                const outcomeCls = e.outcome === "success" ? "border-success/40 text-success"
                  : e.outcome === "failure" ? "border-danger/40 text-danger"
                  : e.outcome === "neutral" ? "border-muted-foreground/30 text-muted-foreground"
                  : "border-warning/40 text-warning";
                return (
                  <div key={e.id} className="flex items-center justify-between gap-2 rounded-md border border-border/30 bg-muted/10 p-2 text-[11px]">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="border-primary/30 font-mono text-[10px]">{e.asset}</Badge>
                      <span className={cn("font-bold", upDir ? "text-success" : e.action === "SELL" ? "text-danger" : "text-warning")}>
                        {e.action}
                      </span>
                      <span className="text-muted-foreground">·</span>
                      <span className="text-muted-foreground">conf {e.confidence}</span>
                      <span className="text-muted-foreground">· {e.regime}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {e.pnlPct != null && (
                        <span className={cn("font-mono tabular-nums",
                          e.pnlPct > 0 ? "text-success" : e.pnlPct < 0 ? "text-danger" : "text-muted-foreground")}>
                          {e.pnlPct > 0 ? "+" : ""}{e.pnlPct.toFixed(2)}%
                        </span>
                      )}
                      <Badge variant="outline" className={cn("text-[9px] uppercase", outcomeCls)}>
                        {e.outcome}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>

        {/* Strategy Adaptation */}
        <Panel
          icon={<Compass className="h-4 w-4" />}
          title={ar ? "تكيّف الاستراتيجية" : "Strategy Adaptation"}
          subtitle={patchAr(adaptation.focus, ar)}
        >
          <div className="grid grid-cols-3 gap-2">
            <StatTile label={ar ? "الميل" : "Bias"} value={adaptation.bias}
              tone={adaptation.bias === "constructive" ? "good" : adaptation.bias === "preserve" || adaptation.bias === "defensive" ? "bad" : "neutral"} />
            <StatTile label={ar ? "العدوانية" : "Aggression"} value={adaptation.aggressionLevel} />
            <StatTile label={ar ? "الحذر" : "Caution"} value={adaptation.cautionLevel}
              tone={adaptation.cautionLevel >= 70 ? "bad" : adaptation.cautionLevel >= 50 ? "warn" : "good"} />
          </div>
          <div className="mt-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {ar ? "مستوى الحذر" : "Caution Level"}
            </div>
            <Progress value={adaptation.cautionLevel} className="mt-1 h-1.5" />
          </div>
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{patchAr(adaptation.recommendation, ar)}</p>
          {adaptation.rules.length > 0 && (
            <ul className="mt-3 space-y-1">
              {adaptation.rules.map((r, i) => (
                <li key={i} className="flex items-start gap-2 text-[11px] text-muted-foreground">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary" />
                  <span>{patchAr(r, ar)}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        {/* Asset Personality Matrix */}
        <Panel
          icon={<Fingerprint className="h-4 w-4" />}
          title={ar ? "شخصية الأصول" : "Asset Personality Matrix"}
          subtitle={ar ? "أنماط السلوك التاريخية لكل أصل" : "Behavioral DNA of each asset"}
        >
          <div className="space-y-2">
            {personalities.map((p) => (
              <div key={p.asset} className="rounded-lg border border-border/40 bg-muted/10 p-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="border-primary/30 font-mono text-[10px]">{p.asset}</Badge>
                    <span className="text-xs font-semibold">{p.assetName}</span>
                  </div>
                  <Badge variant="outline" className={cn("text-[10px] uppercase", archetypeTone(p.archetype))}>
                    {p.archetype.replace("-", " ")}
                  </Badge>
                </div>
                <div className="mt-2 grid grid-cols-4 gap-1.5 text-[9px] uppercase tracking-wider text-muted-foreground">
                  <div>
                    <div>{ar ? "تقلب" : "Vol"}</div>
                    <div className="mt-0.5 font-mono text-xs font-bold text-foreground">{p.volatilityTrait}</div>
                  </div>
                  <div>
                    <div>{ar ? "زخم" : "Persist"}</div>
                    <div className="mt-0.5 font-mono text-xs font-bold text-foreground">{p.momentumPersistence}</div>
                  </div>
                  <div>
                    <div>{ar ? "انعكاس" : "Reversal"}</div>
                    <div className="mt-0.5 font-mono text-xs font-bold text-foreground">{p.reversalTendency}</div>
                  </div>
                  <div>
                    <div>{ar ? "ثبات" : "Stability"}</div>
                    <div className={cn("mt-0.5 font-mono text-xs font-bold",
                      p.stabilityScore >= 65 ? "text-success" : p.stabilityScore >= 40 ? "text-foreground" : "text-warning")}>
                      {p.stabilityScore}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      {/* Self-Evaluation — full width */}
      <Panel
        icon={<ShieldCheck className="h-4 w-4" />}
        title={ar ? "التقييم الذاتي للذكاء الاصطناعي" : "AI Self-Evaluation"}
        subtitle={patchAr(selfEval.summary, ar)}
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <div className={cn(
            "col-span-2 rounded-xl border p-3",
            healthTone === "good" ? "border-success/40 bg-success/5" :
            healthTone === "warn" ? "border-warning/40 bg-warning/5" :
            "border-danger/40 bg-danger/5",
          )}>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {ar ? "صحة النظام" : "System Health"}
            </div>
            <div className={cn("mt-1 font-display text-3xl font-bold tabular-nums",
              healthTone === "good" ? "text-success" : healthTone === "warn" ? "text-warning" : "text-danger")}>
              {selfEval.systemHealth}
              <span className="ms-1 text-base font-normal text-muted-foreground">/100</span>
            </div>
            <Progress value={selfEval.systemHealth} className="mt-2 h-1" />
          </div>
          <StatTile label={ar ? "جودة الإشارات" : "Signal Q"} value={selfEval.signalQuality}
            tone={selfEval.signalQuality >= 65 ? "good" : "warn"} />
          <StatTile label={ar ? "واقعية الثقة" : "Conf Realism"} value={selfEval.confidenceRealism}
            tone={selfEval.confidenceRealism >= 65 ? "good" : selfEval.confidenceRealism >= 45 ? "warn" : "bad"} />
          <StatTile label={ar ? "معايرة المخاطر" : "Risk Cal"} value={selfEval.riskCalibration}
            tone={selfEval.riskCalibration >= 65 ? "good" : "warn"} />
          <StatTile label={ar ? "جودة التكيف" : "Adapt Q"} value={selfEval.adaptationQuality}
            tone={selfEval.adaptationQuality >= 55 ? "good" : "warn"} />
        </div>

        {selfEval.flags.length > 0 && (
          <div className="mt-4 space-y-1.5">
            {selfEval.flags.map((f, i) => (
              <div key={i} className={cn(
                "flex items-start gap-2 rounded-md border p-2 text-[11px]",
                f.severity === "critical" ? "border-danger/40 bg-danger/5 text-danger" :
                f.severity === "warning" ? "border-warning/40 bg-warning/5 text-warning" :
                "border-border/40 bg-muted/10 text-muted-foreground",
              )}>
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{patchAr(f.message, ar)}</span>
              </div>
            ))}
          </div>
        )}

        {(stats.byRegime.length > 0 || stats.byAsset.length > 0) && (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {stats.byRegime.length > 0 && (
              <div className="rounded-lg border border-border/40 bg-muted/10 p-3">
                <div className="mb-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                  {ar ? "الأداء حسب النظام" : "Performance by Regime"}
                </div>
                <div className="space-y-1">
                  {stats.byRegime.slice(0, 5).map((r) => (
                    <div key={r.regime} className="flex items-center justify-between text-[11px]">
                      <span className="text-foreground">{r.regime}</span>
                      <span className="flex items-center gap-2">
                        <span className="text-muted-foreground">n={r.count}</span>
                        <span className={cn("font-mono font-bold",
                          r.winRate >= 60 ? "text-success" : r.winRate >= 45 ? "text-warning" : "text-danger")}>
                          {r.winRate}%
                        </span>
                        {r.winRate >= 50 ? <TrendingUp className="h-3 w-3 text-success" /> : <TrendingDown className="h-3 w-3 text-danger" />}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {stats.byAsset.length > 0 && (
              <div className="rounded-lg border border-border/40 bg-muted/10 p-3">
                <div className="mb-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                  {ar ? "الأداء حسب الأصل" : "Performance by Asset"}
                </div>
                <div className="space-y-1">
                  {stats.byAsset.slice(0, 5).map((a) => (
                    <div key={a.asset} className="flex items-center justify-between text-[11px]">
                      <span className="text-foreground">{a.asset}</span>
                      <span className="flex items-center gap-2">
                        <span className="text-muted-foreground">n={a.count}</span>
                        <span className={cn("font-mono font-bold",
                          a.winRate >= 60 ? "text-success" : a.winRate >= 45 ? "text-warning" : "text-danger")}>
                          {a.winRate}%
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Panel>
    </section>
  );
}
