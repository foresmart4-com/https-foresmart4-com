// Arabic-first AI learning insights panel — Phase 9.
// Reads from local trade memory + self-learning engine and renders:
//   • Strategy experiments log + per-strategy success metrics
//   • Predicted vs. realized win rate (calibration)
//   • Best / worst decisions
//   • What the system learned (auto-generated bullets)
//   • Decision sources, confidence score, risk level
//   • Per-asset insights: why fit / not fit, factors, counter-scenario,
//     when the view changes
//
// Strictly avoids "100% certainty" wording. Always frames outputs as
// analytical signals — never as definitive financial advice.

import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Brain,
  Sparkles,
  Trophy,
  AlertTriangle,
  HelpCircle,
  Compass,
  Layers,
  Activity,
  ShieldAlert,
  GitBranch,
  ListChecks,
  Info,
} from "lucide-react";
import { aiMemory } from "@/services/learning/aiMemory";
import {
  strategyScores,
  calibration,
  driftReport,
  ece,
  metaTuneThreshold,
  overallStats,
} from "@/services/learning/selfLearningEngine";

// ─────────────────────────────────────────────────────────────
// Helpers (Arabic copy + scoring)
// ─────────────────────────────────────────────────────────────
const fmtPct = (x: number) =>
  isFinite(x) ? `${(x * 100).toFixed(1)}%` : "—";
const fmtNum = (x: number, d = 2) =>
  isFinite(x) ? x.toFixed(d) : "—";

function riskFromConfidence(c?: number): {
  level: "منخفضة" | "متوسطة" | "مرتفعة" | "غير محددة";
  cls: string;
} {
  if (c === undefined || isNaN(c))
    return { level: "غير محددة", cls: "bg-muted text-muted-foreground" };
  if (c >= 0.7)
    return { level: "منخفضة", cls: "bg-success/15 text-success border-success/30" };
  if (c >= 0.45)
    return { level: "متوسطة", cls: "bg-warning/15 text-warning border-warning/30" };
  return { level: "مرتفعة", cls: "bg-danger/15 text-danger border-danger/30" };
}

function confidenceLabel(c?: number): string {
  if (c === undefined) return "غير معروفة";
  if (c >= 0.75) return "ثقة عالية تحليلياً";
  if (c >= 0.55) return "ثقة معتدلة";
  if (c >= 0.35) return "ثقة منخفضة";
  return "إشارة ضعيفة";
}

function tagSources(tags?: string[]): { strategy?: string; agent?: string; rest: string[] } {
  if (!tags) return { rest: [] };
  let strategy: string | undefined;
  let agent: string | undefined;
  const rest: string[] = [];
  for (const t of tags) {
    if (t.startsWith("strategy:")) strategy = t.slice("strategy:".length);
    else if (t.startsWith("agent:")) agent = t.slice("agent:".length);
    else rest.push(t);
  }
  return { strategy, agent, rest };
}

// Helper component: a tiny info badge with an Arabic tooltip
function InfoHint({ text }: { text: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label="شرح"
          className="inline-flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground hover:text-foreground"
        >
          <HelpCircle className="h-3.5 w-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs text-xs leading-relaxed">
        {text}
      </TooltipContent>
    </Tooltip>
  );
}

// ─────────────────────────────────────────────────────────────
// Main panel
// ─────────────────────────────────────────────────────────────
export function AILearningInsightsPanel({ sinceMs }: { sinceMs?: number }) {
  const entries = useMemo(() => {
    const all = aiMemory.list();
    if (!sinceMs) return all;
    const cutoff = Date.now() - sinceMs;
    return all.filter((r) => r.ts >= cutoff);
  }, [sinceMs]);

  const closed = useMemo(
    () => entries.filter((e) => e.outcome === "win" || e.outcome === "loss"),
    [entries],
  );

  const strategies = useMemo(() => strategyScores(sinceMs).slice(0, 8), [sinceMs]);
  const calBins = useMemo(() => calibration(sinceMs), [sinceMs]);
  const drift = useMemo(() => driftReport(30, sinceMs), [sinceMs]);
  const eceVal = useMemo(() => ece(sinceMs), [sinceMs]);
  const meta = useMemo(() => metaTuneThreshold(sinceMs), [sinceMs]);
  const overall = useMemo(() => overallStats(sinceMs), [sinceMs]);

  const sortedByPnl = useMemo(
    () => [...closed].sort((a, b) => (b.pnlPct ?? 0) - (a.pnlPct ?? 0)),
    [closed],
  );
  const bestDecisions = sortedByPnl.slice(0, 3);
  const worstDecisions = sortedByPnl.slice(-3).reverse();

  // "ماذا تعلم النظام" — auto-generated, descriptive (not prescriptive)
  const lessons: string[] = useMemo(() => {
    const out: string[] = [];
    if (overall.trades === 0) {
      out.push("لا توجد قرارات مغلقة بعد ضمن النطاق الزمني المختار — النظام في وضع المراقبة.");
      return out;
    }
    out.push(
      `معدل النجاح التحليلي للقرارات المغلقة: ${fmtPct(overall.winRate)} على ${overall.trades} قرار.`,
    );
    if (eceVal > 0.12) {
      out.push(
        `معايرة الثقة بحاجة لضبط (ECE = ${eceVal.toFixed(3)}). يميل النظام لإفراط أو تقليل تقدير الاحتمال.`,
      );
    } else if (overall.trades >= 10) {
      out.push(`الثقة المعلنة من النظام متسقة نسبياً مع النتائج الفعلية (ECE = ${eceVal.toFixed(3)}).`);
    }
    if (drift.isDrifting) {
      out.push(
        `اكتشاف انجراف: معدل النجاح الحديث ${fmtPct(drift.recentWinRate)} مقابل خط الأساس ${fmtPct(drift.baselineWinRate)}. يستدعي مراجعة شروط السوق.`,
      );
    }
    if (meta.improvement > 0.001 && meta.threshold > 0) {
      out.push(`اقتراح ميتا-تعلم: رفع حد الثقة إلى ${(meta.threshold * 100).toFixed(0)}% قد يُحسّن التوقع بنحو ${(meta.improvement * 100).toFixed(2)}%.`);
    }
    if (strategies[0]) {
      out.push(
        `أفضل استراتيجية حالياً: «${strategies[0].strategy}» بنجاح ${fmtPct(strategies[0].winRate)} ومعامل ربحية ${fmtNum(strategies[0].profitFactor)}.`,
      );
    }
    return out;
  }, [overall, eceVal, drift, meta, strategies]);

  // Per-asset analytical insights (top 3 active symbols by recency)
  const assetInsights = useMemo(() => {
    const seen = new Map<string, typeof entries>();
    for (const e of entries) {
      if (!seen.has(e.symbol)) seen.set(e.symbol, []);
      seen.get(e.symbol)!.push(e);
    }
    return [...seen.entries()].slice(0, 4).map(([symbol, rows]) => {
      const closedRows = rows.filter((r) => r.outcome === "win" || r.outcome === "loss");
      const wins = closedRows.filter((r) => r.outcome === "win").length;
      const wr = closedRows.length ? wins / closedRows.length : 0;
      const lastConf = rows[0]?.confidence;
      const risk = riskFromConfidence(lastConf);
      const fit = wr >= 0.55 && (lastConf ?? 0) >= 0.5;
      const dominantRegime = rows.find((r) => r.regime)?.regime;
      return {
        symbol,
        trades: closedRows.length,
        winRate: wr,
        confidence: lastConf,
        risk,
        fit,
        regime: dominantRegime,
        why: fit
          ? "السجل التحليلي يُظهر اتساقاً بين التوقع والنتيجة، مع ثقة معتدلة وما فوق."
          : "السجل التحليلي يُظهر تذبذباً أو ثقة منخفضة — لا يعني سلبية الأصل، بل أن إشارات النظام غير حاسمة.",
        factors: [
          `معدل نجاح ${fmtPct(wr)} على ${closedRows.length} قرار مغلق`,
          lastConf !== undefined
            ? `آخر درجة ثقة تحليلية: ${(lastConf * 100).toFixed(0)}%`
            : "لا توجد درجة ثقة حديثة",
          dominantRegime ? `النظام السائد المرصود: ${dominantRegime}` : "لم يُرصد نظام سوقي مهيمن",
        ],
        counter: fit
          ? "السيناريو المعاكس: تغيّر النظام السوقي أو ضعف السيولة قد يقلب الإشارة."
          : "السيناريو المعاكس: استقرار اتجاهي وزيادة الزخم قد يُحسّن جودة الإشارة.",
        triggers: [
          "تجاوز الثقة ٧٥٪ مع تأكيد إطارين زمنيين",
          "تغيّر النظام السوقي (Regime) لأكثر من ٤٨ ساعة",
          "كسر مستوى مرجعي مؤكد بحجم تداول مرتفع",
        ],
      };
    });
  }, [entries]);

  // ─── Render ──────────────────────────────────────────────
  return (
    <div dir="rtl" className="space-y-6">
      {/* Disclaimer banner */}
      <div className="rounded-xl border border-warning/30 bg-warning/5 p-3 text-xs leading-relaxed text-warning-foreground">
        <div className="flex items-start gap-2">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <span>
            هذه الرؤى تحليلية تعليمية مبنية على سجل النظام، وليست توصية مالية قطعية.
            تُعرض كاحتمالات ومخاطر وسيناريوهات مساعدة في اتخاذ القرار.
          </span>
        </div>
      </div>

      {/* What the system learned */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Brain className="h-4 w-4 text-primary" />
            ماذا تعلّم النظام
            <InfoHint text="ملخص آلي مستخرج من سجل قراراتك المغلقة، يوضّح ما تحسّن وما يحتاج ضبطاً. لا يُمثّل توصية." />
          </CardTitle>
          <Badge variant="outline" className="text-[10px]">آلي</Badge>
        </CardHeader>
        <CardContent className="space-y-2 text-sm leading-relaxed">
          {lessons.map((l, i) => (
            <div key={i} className="flex items-start gap-2">
              <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
              <span>{l}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Strategy experiments */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Layers className="h-4 w-4 text-primary" />
            سجل تجارب الاستراتيجيات
            <InfoHint text="كل صف يمثّل استراتيجية اقترحها النظام. معدل النجاح هو نسبة القرارات المغلقة الرابحة، ومعامل الربحية = مجموع الأرباح ÷ مجموع الخسائر." />
          </CardTitle>
        </CardHeader>
        <CardContent>
          {strategies.length === 0 ? (
            <p className="text-sm text-muted-foreground">لا توجد بيانات استراتيجيات بعد ضمن النطاق الزمني المختار.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground">
                  <tr className="border-b border-border">
                    <th className="px-2 py-2 text-start">الاستراتيجية</th>
                    <th className="px-2 py-2 text-center">قرارات</th>
                    <th className="px-2 py-2 text-center">معدل النجاح</th>
                    <th className="px-2 py-2 text-center">التوقع</th>
                    <th className="px-2 py-2 text-center">معامل الربحية</th>
                    <th className="px-2 py-2 text-center">أفضل نظام سوقي</th>
                  </tr>
                </thead>
                <tbody>
                  {strategies.map((s) => (
                    <tr key={s.strategy} className="border-b border-border/50">
                      <td className="px-2 py-2 font-medium">{s.strategy}</td>
                      <td className="px-2 py-2 text-center">{s.trades}</td>
                      <td className="px-2 py-2 text-center">
                        <span className={s.winRate >= 0.55 ? "text-success" : s.winRate <= 0.4 ? "text-danger" : ""}>
                          {fmtPct(s.winRate)}
                        </span>
                      </td>
                      <td className="px-2 py-2 text-center">{fmtPct(s.expectancy)}</td>
                      <td className="px-2 py-2 text-center">{fmtNum(s.profitFactor)}</td>
                      <td className="px-2 py-2 text-center text-muted-foreground">{s.bestRegime ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Predicted vs realized */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="h-4 w-4 text-primary" />
            مقارنة التوقع بالنتيجة الفعلية
            <InfoHint text="نُقارن متوسط الثقة المتوقعة لكل شريحة (مثلاً ٦٠٪-٧٠٪) بمعدل النجاح الفعلي. الفجوة الكبيرة تعني أن النظام يحتاج إعادة معايرة." />
          </CardTitle>
        </CardHeader>
        <CardContent>
          {calBins.length === 0 ? (
            <p className="text-sm text-muted-foreground">لا توجد قرارات مغلقة كافية لبناء منحنى المعايرة.</p>
          ) : (
            <div className="space-y-2">
              {calBins.map((b) => (
                <div key={b.bucket} className="flex items-center gap-3">
                  <div className="w-16 text-xs text-muted-foreground">{b.bucket}%</div>
                  <Progress value={b.observed * 100} className="h-2 flex-1" />
                  <div className="w-32 text-xs text-muted-foreground">
                    متوقع {(b.predicted * 100).toFixed(0)}% · فعلي {(b.observed * 100).toFixed(0)}%
                  </div>
                </div>
              ))}
              <p className="pt-2 text-[11px] text-muted-foreground">
                مؤشر خطأ المعايرة (ECE): {eceVal.toFixed(3)} — كلما اقترب من الصفر كانت ثقة النظام أكثر دقة.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Best & Worst decisions */}
      <div className="grid gap-4 lg:grid-cols-2">
        <DecisionList
          title="أفضل القرارات"
          icon={<Trophy className="h-4 w-4 text-success" />}
          rows={bestDecisions}
          emptyText="لا توجد قرارات رابحة بعد."
          tone="success"
        />
        <DecisionList
          title="أسوأ القرارات"
          icon={<AlertTriangle className="h-4 w-4 text-danger" />}
          rows={worstDecisions}
          emptyText="لا توجد قرارات خاسرة مسجلة — أو لا توجد بيانات كافية."
          tone="danger"
        />
      </div>

      {/* Per-asset analytical insights */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Compass className="h-4 w-4 text-primary" />
            رؤى تحليلية لكل أصل
            <InfoHint text="لكل أصل: مدى ملاءمته لإشارات النظام حالياً، العوامل المؤثرة، السيناريو المعاكس، ومتى تتغير الرؤية. هذه مؤشرات احتمالية وليست توصية." />
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {assetInsights.length === 0 ? (
            <p className="text-sm text-muted-foreground">لا توجد أصول في سجل القرارات بعد.</p>
          ) : (
            assetInsights.map((a) => (
              <div key={a.symbol} className="rounded-lg border border-border bg-muted/20 p-3">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="font-display text-sm font-bold">{a.symbol}</span>
                  <Badge variant="outline" className={a.risk.cls}>
                    مخاطرة {a.risk.level}
                  </Badge>
                  <Badge variant="outline" className="text-[10px]">
                    {confidenceLabel(a.confidence)}
                  </Badge>
                  {a.fit ? (
                    <Badge className="bg-success/15 text-success border-success/30">
                      مناسب تحليلياً
                    </Badge>
                  ) : (
                    <Badge className="bg-muted text-muted-foreground">إشارة غير حاسمة</Badge>
                  )}
                </div>
                <p className="text-xs leading-relaxed text-foreground/90">{a.why}</p>
                <div className="mt-2 grid gap-2 text-[11px] text-muted-foreground sm:grid-cols-2">
                  <div>
                    <div className="mb-1 flex items-center gap-1 font-medium text-foreground/80">
                      <ListChecks className="h-3 w-3" /> العوامل المؤثرة
                    </div>
                    <ul className="list-inside list-disc space-y-0.5">
                      {a.factors.map((f, i) => <li key={i}>{f}</li>)}
                    </ul>
                  </div>
                  <div>
                    <div className="mb-1 flex items-center gap-1 font-medium text-foreground/80">
                      <GitBranch className="h-3 w-3" /> السيناريو المعاكس
                    </div>
                    <p>{a.counter}</p>
                    <div className="mt-2 mb-1 flex items-center gap-1 font-medium text-foreground/80">
                      <Info className="h-3 w-3" /> متى تتغير الرؤية؟
                    </div>
                    <ul className="list-inside list-disc space-y-0.5">
                      {a.triggers.map((t, i) => <li key={i}>{t}</li>)}
                    </ul>
                  </div>
                </div>
                <div className="mt-3 flex gap-2">
                  <Link to="/market-intelligence" search={{}}>
                    <Button size="sm" variant="outline" className="h-7 text-xs">
                      فتح في ذكاء السوق
                    </Button>
                  </Link>
                  <Link to="/assets-portfolio">
                    <Button size="sm" variant="ghost" className="h-7 text-xs">
                      عرض في محفظتي
                    </Button>
                  </Link>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────
function DecisionList({
  title,
  icon,
  rows,
  emptyText,
  tone,
}: {
  title: string;
  icon: React.ReactNode;
  rows: ReturnType<typeof aiMemory.list>;
  emptyText: string;
  tone: "success" | "danger";
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          {icon}
          {title}
          <InfoHint text="القرارات مرتبة حسب نسبة الربح أو الخسارة المسجّلة. تُستخدم لمراجعة جودة الإشارات وليست توصية بتكرارها." />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">{emptyText}</p>
        ) : (
          rows.map((r) => {
            const src = tagSources(r.tags);
            const risk = riskFromConfidence(r.confidence);
            return (
              <div key={r.id} className="rounded-lg border border-border bg-muted/20 p-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-display text-sm font-bold">{r.symbol}</span>
                    <Badge variant="outline" className="text-[10px] capitalize">
                      {r.side === "buy" ? "شراء" : "بيع"}
                    </Badge>
                    <Badge variant="outline" className={risk.cls + " text-[10px]"}>
                      مخاطرة {risk.level}
                    </Badge>
                  </div>
                  <div
                    className={
                      "text-sm font-semibold " +
                      (tone === "success" ? "text-success" : "text-danger")
                    }
                  >
                    {fmtPct(r.pnlPct ?? 0)}
                  </div>
                </div>
                <div className="mt-1 text-[11px] text-muted-foreground">
                  مصادر القرار: {src.strategy ? `استراتيجية «${src.strategy}»` : "استراتيجية غير محددة"}
                  {src.agent ? ` · وكيل «${src.agent}»` : ""}
                  {r.regime ? ` · نظام سوقي ${r.regime}` : ""}
                  {r.confidence !== undefined ? ` · ${confidenceLabel(r.confidence)}` : ""}
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
