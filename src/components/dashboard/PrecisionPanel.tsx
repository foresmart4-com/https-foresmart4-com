import { memo } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ConfidenceBar, RiskHeat } from "@/components/dashboard/ConfidenceBar";
import { Award, Filter, Gauge, Radar, Activity, ShieldCheck } from "lucide-react";
import type { MarketIntel } from "@/services/analysis";

function Panel({ className, children }: { className?: string; children?: React.ReactNode }) {
  return (
    <Card className={cn(
      "border-border/50 bg-card/40 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.25)]",
      "transition-all hover:border-primary/40", className,
    )}>{children}</Card>
  );
}

const RATING_TONE: Record<string, string> = {
  AAA: "border-success/50 text-success bg-success/10",
  AA:  "border-success/40 text-success bg-success/5",
  A:   "border-primary/40 text-primary bg-primary/5",
  BBB: "border-primary/30 text-primary",
  BB:  "border-warning/40 text-warning bg-warning/5",
  B:   "border-warning/40 text-warning",
  C:   "border-danger/40 text-danger bg-danger/5",
};

const TIER_TONE: Record<string, string> = {
  premium:  "border-success/50 text-success bg-success/10",
  standard: "border-primary/40 text-primary bg-primary/10",
  scout:    "border-warning/40 text-warning bg-warning/5",
  skip:     "border-danger/40 text-danger bg-danger/5",
};

const GRADE_TONE: Record<string, string> = {
  A: "border-success/40 text-success",
  B: "border-primary/40 text-primary",
  C: "border-warning/40 text-warning",
  D: "border-danger/40 text-danger",
};

export const PrecisionPanel = memo(function PrecisionPanel({ data, ar }: { data: MarketIntel; ar: boolean }) {
  const scores = data.institutionalScores.slice(0, 5);
  const priorities = data.priorities.slice(0, 5);
  const filtered = data.filteredSignals.slice(0, 6);
  const noise = data.noiseReports.slice(0, 5);
  const stab = data.noiseSummary;

  return (
    <section className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-accent to-primary text-primary-foreground shadow-glow">
          <ShieldCheck className="h-4 w-4" />
        </span>
        <div>
          <h2 className="font-display text-lg font-bold leading-tight">
            {ar ? "طبقة الدقة المؤسسية" : "Precision Intelligence Layer"}
          </h2>
          <p className="text-[11px] text-muted-foreground">
            {ar ? "تصفية الإشارات · أولوية · ضوضاء · جودة تنفيذ" : "Signal filter · priority · noise · execution quality"}
          </p>
        </div>
      </div>

      {/* Market Stability Meter (full width) */}
      <Panel className="p-5">
        <div className="mb-3 flex items-center gap-2">
          <Gauge className="h-4 w-4 text-primary" />
          <h3 className="font-display text-base font-bold">
            {ar ? "مقياس استقرار السوق" : "Market Stability Meter"}
          </h3>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-border/40 bg-muted/10 p-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {ar ? "استقرار" : "Stability"}
            </div>
            <div className="mt-1 font-display text-2xl font-bold tabular-nums">{stab.marketStability}</div>
            <ConfidenceBar value={stab.marketStability} className="mt-1.5" />
          </div>
          <div className="rounded-lg border border-border/40 bg-muted/10 p-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {ar ? "ضوضاء السوق" : "Market Noise"}
            </div>
            <div className="mt-1 font-display text-2xl font-bold tabular-nums">{stab.marketNoise}</div>
            <RiskHeat value={stab.marketNoise} className="mt-1.5" />
          </div>
          <div className="rounded-lg border border-border/40 bg-muted/10 p-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {ar ? "خطر المبالغة" : "Overreaction Risk"}
            </div>
            <div className="mt-1 font-display text-2xl font-bold tabular-nums">{stab.overreactionRisk}</div>
            <RiskHeat value={stab.overreactionRisk} className="mt-1.5" />
          </div>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">{stab.note}</p>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Institutional Signal Ratings */}
        <Panel className="p-5">
          <div className="mb-3 flex items-center gap-2">
            <Award className="h-4 w-4 text-primary" />
            <h3 className="font-display text-base font-bold">
              {ar ? "تقييمات الإشارات المؤسسية" : "Institutional Signal Ratings"}
            </h3>
          </div>
          <div className="space-y-2">
            {scores.map((s) => (
              <div key={s.asset} className="rounded-lg border border-border/40 bg-muted/10 p-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold">{s.asset}</span>
                    <span className="text-[11px] text-muted-foreground">{s.assetName}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Badge variant="outline" className={cn("text-[10px] font-bold", RATING_TONE[s.rating])}>{s.rating}</Badge>
                    <span className="text-[10px] text-muted-foreground">{s.edgeQuality}/100</span>
                  </div>
                </div>
                <div className="mt-1.5 grid grid-cols-3 gap-1.5 text-[10px]">
                  <Metric label={ar ? "إشارة" : "Sig"}   v={s.components.signal} />
                  <Metric label={ar ? "توقيت" : "Time"}  v={s.components.timing} />
                  <Metric label={ar ? "نظام" : "Reg"}    v={s.components.regime} />
                  <Metric label={ar ? "فرصة" : "Opp"}    v={s.components.opportunity} />
                  <Metric label={ar ? "تنفيذ" : "Exec"}  v={s.components.execution} />
                  <Metric label={ar ? "معدّل" : "R-Adj"} v={s.components.riskAdjusted} />
                </div>
              </div>
            ))}
          </div>
        </Panel>

        {/* AI Priority Feed */}
        <Panel className="p-5">
          <div className="mb-3 flex items-center gap-2">
            <Radar className="h-4 w-4 text-accent" />
            <h3 className="font-display text-base font-bold">{ar ? "موجز الأولوية" : "AI Priority Feed"}</h3>
          </div>
          {priorities.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              {ar ? "لا توجد فرص بمستوى مؤسسي حالياً." : "No setups currently meet institutional priority."}
            </p>
          ) : (
            <div className="space-y-2">
              {priorities.map((p) => (
                <div key={p.asset} className="rounded-lg border border-border/40 bg-muted/10 p-2.5">
                  <div className="mb-1 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="rounded border border-primary/40 bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary">
                        {p.level}
                      </span>
                      <span className="text-sm font-bold">{p.asset}</span>
                      <Badge variant="outline" className={cn("text-[10px]", TIER_TONE[p.tier])}>{p.tier}</Badge>
                    </div>
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{p.urgency}</span>
                  </div>
                  <ConfidenceBar value={p.score} />
                  <p className="mt-1.5 text-[11px] text-muted-foreground">{p.headline}</p>
                </div>
              ))}
            </div>
          )}
        </Panel>

        {/* Execution Quality Grades (filtered signals) */}
        <Panel className="p-5">
          <div className="mb-3 flex items-center gap-2">
            <Filter className="h-4 w-4 text-primary" />
            <h3 className="font-display text-base font-bold">{ar ? "درجات جودة التنفيذ" : "Execution Quality Grades"}</h3>
          </div>
          <div className="space-y-2">
            {filtered.map((f) => (
              <div key={f.asset} className="rounded-lg border border-border/40 bg-muted/10 p-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold">{f.asset}</span>
                    <Badge variant="outline" className={cn("text-[10px]", GRADE_TONE[f.grade])}>{f.grade}</Badge>
                    {!f.accepted && (
                      <span className="text-[10px] uppercase tracking-wider text-danger">
                        {ar ? "مرفوضة" : "Filtered"}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-muted-foreground">
                    {ar ? "ثقة" : "Conf"} {f.institutionalConfidence}
                  </span>
                </div>
                <ConfidenceBar value={f.institutionalConfidence} className="mt-1.5" />
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {(f.accepted ? f.notes : [f.rejectReason ?? "", ...f.notes]).filter(Boolean).slice(0, 3).map((n, i) => (
                    <span key={i} className="rounded border border-border/40 bg-background/40 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                      {n}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Panel>

        {/* Noise & Stability Monitor */}
        <Panel className="p-5">
          <div className="mb-3 flex items-center gap-2">
            <Activity className="h-4 w-4 text-warning" />
            <h3 className="font-display text-base font-bold">{ar ? "مراقب الضوضاء" : "Noise & Stability Monitor"}</h3>
          </div>
          <div className="space-y-2">
            {noise.map((n) => (
              <div key={n.asset} className="rounded-lg border border-border/40 bg-muted/10 p-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold">{n.asset}</span>
                  <div className="flex items-center gap-2 text-[10px]">
                    <span className="text-muted-foreground">
                      {ar ? "ضوضاء" : "Noise"} <span className="font-mono tabular-nums">{n.noiseLevel}</span>
                    </span>
                    <span className="text-muted-foreground">
                      {ar ? "كسر زائف" : "Fake-BO"} <span className="font-mono tabular-nums">{n.fakeBreakoutRisk}</span>
                    </span>
                  </div>
                </div>
                <RiskHeat value={n.noiseLevel} className="mt-1.5" />
                {n.flags.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {n.flags.map((f, i) => (
                      <span key={i} className="rounded border border-warning/30 bg-warning/5 px-1.5 py-0.5 text-[10px] text-warning">
                        {f}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </section>
  );
});

function Metric({ label, v }: { label: string; v: number }) {
  return (
    <div className="rounded border border-border/30 bg-background/30 p-1.5">
      <div className="text-muted-foreground">{label}</div>
      <div className="font-mono tabular-nums">{Math.round(v)}</div>
    </div>
  );
}
