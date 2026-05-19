import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { useAIValidation } from "@/hooks/useAIValidation";
import { useI18n } from "@/lib/i18n";
import { Download, RefreshCcw, Activity, Brain, AlertTriangle, TrendingUp, Gauge } from "lucide-react";
import { loadRecords, recordsToCSV, download } from "@/services/ai-validation";

const L = {
  title:        { en: "AI Accuracy & Performance",  ar: "دقة وأداء الذكاء الاصطناعي" },
  subtitle:     { en: "Institutional validation of every recommendation",  ar: "تحقق مؤسسي من كل توصية" },
  refresh:      { en: "Refresh",                      ar: "تحديث" },
  exportCsv:    { en: "Export CSV",                   ar: "تصدير CSV" },
  scorecard:    { en: "Scorecard",                    ar: "بطاقة الأداء" },
  calibration:  { en: "Calibration",                  ar: "المعايرة" },
  drift:        { en: "Drift",                        ar: "الانحراف" },
  fp:           { en: "FP / FN",                      ar: "إيجابيات/سلبيات كاذبة" },
  pnl:          { en: "PnL & Sharpe",                 ar: "العائد ونسبة شارب" },
  aging:        { en: "Aging",                        ar: "تقادم التوصيات" },
  regime:       { en: "Regime",                       ar: "النظام السوقي" },
  agents:       { en: "Agents",                       ar: "الوكلاء" },
  health:       { en: "Model Health",                 ar: "صحة النموذج" },
  hitRate:      { en: "Hit rate",                     ar: "نسبة الإصابة" },
  precision:    { en: "Precision",                    ar: "الدقة" },
  recall:       { en: "Recall",                       ar: "الاستدعاء" },
  f1:           { en: "F1",                           ar: "F1" },
  brier:        { en: "Brier score",                  ar: "Brier" },
  edge:         { en: "Edge vs 50%",                  ar: "الميزة فوق 50%" },
  pending:      { en: "Pending",                      ar: "قيد الحل" },
  resolved:     { en: "Resolved",                     ar: "محلولة" },
  total:        { en: "Total",                        ar: "الإجمالي" },
  reliability:  { en: "Reliability",                  ar: "موثوقية المعايرة" },
  ece:          { en: "Expected Calibration Error",   ar: "خطأ المعايرة المتوقع" },
  overconf:     { en: "Overconfidence",               ar: "الثقة الزائدة" },
  recent:       { en: "Recent hit rate",              ar: "أحدث نسبة إصابة" },
  baseline:     { en: "Baseline hit rate",            ar: "النسبة المرجعية" },
  delta:        { en: "Δ",                            ar: "الفرق" },
  status:       { en: "Status",                       ar: "الحالة" },
  cumPnl:       { en: "Cumulative PnL %",             ar: "إجمالي الربح %" },
  sharpe:       { en: "Sharpe",                       ar: "شارب" },
  sortino:      { en: "Sortino",                      ar: "سورتينو" },
  maxDD:        { en: "Max drawdown",                 ar: "أقصى تراجع" },
  benchmark:    { en: "Benchmark",                    ar: "المعيار" },
  excess:       { en: "Excess return",                ar: "العائد الفائق" },
  fpRate:       { en: "False positive rate",          ar: "نسبة الإيجابيات الكاذبة" },
  fnRate:       { en: "False negative rate",          ar: "نسبة السلبيات الكاذبة" },
  ageBucket:    { en: "Age",                          ar: "العمر" },
  count:        { en: "Count",                        ar: "العدد" },
  avgReturn:    { en: "Avg return %",                 ar: "متوسط العائد %" },
  agent:        { en: "Agent",                        ar: "الوكيل" },
  hallu:        { en: "Hallucination rate",           ar: "معدل الهلوسة" },
  flagged:      { en: "Flagged signals",              ar: "إشارات مرصودة" },
  noNotes:      { en: "No corrective notes — model behaving within tolerance.", ar: "لا توجد ملاحظات تصحيحية — النموذج ضمن الحدود." },
  empty:        { en: "Waiting for resolved recommendations…", ar: "بانتظار توصيات محلولة…" },
};
const t = (k: keyof typeof L, ar: boolean) => L[k][ar ? "ar" : "en"];

export function AIValidationPanel() {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const { analytics, reload } = useAIValidation(true);
  const { scorecard, calibration, drift, falsePositives, performance, aging, regime, agents, hallucination } = analytics;

  const onExport = () => {
    const csv = recordsToCSV(loadRecords());
    download(`foresmart-ai-validation-${Date.now()}.csv`, csv);
  };

  return (
    <Card className="p-4 sm:p-6 space-y-4" dir={ar ? "rtl" : "ltr"}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2"><Brain className="h-5 w-5 text-primary" /> {t("title", ar)}</h2>
          <p className="text-sm text-muted-foreground">{t("subtitle", ar)}</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={reload}><RefreshCcw className="h-4 w-4 me-1" />{t("refresh", ar)}</Button>
          <Button size="sm" variant="outline" onClick={onExport}><Download className="h-4 w-4 me-1" />{t("exportCsv", ar)}</Button>
        </div>
      </div>

      {scorecard.resolved === 0 ? (
        <p className="text-sm text-muted-foreground">{t("empty", ar)}</p>
      ) : (
        <Tabs defaultValue="scorecard" className="w-full">
          <TabsList className="flex flex-wrap h-auto">
            <TabsTrigger value="scorecard">{t("scorecard", ar)}</TabsTrigger>
            <TabsTrigger value="calibration">{t("calibration", ar)}</TabsTrigger>
            <TabsTrigger value="drift">{t("drift", ar)}</TabsTrigger>
            <TabsTrigger value="fp">{t("fp", ar)}</TabsTrigger>
            <TabsTrigger value="pnl">{t("pnl", ar)}</TabsTrigger>
            <TabsTrigger value="aging">{t("aging", ar)}</TabsTrigger>
            <TabsTrigger value="regime">{t("regime", ar)}</TabsTrigger>
            <TabsTrigger value="agents">{t("agents", ar)}</TabsTrigger>
            <TabsTrigger value="health">{t("health", ar)}</TabsTrigger>
          </TabsList>

          <TabsContent value="scorecard" className="mt-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Stat label={t("hitRate", ar)} value={`${scorecard.hitRate}%`} />
              <Stat label={t("edge", ar)} value={`${scorecard.edge > 0 ? "+" : ""}${scorecard.edge}%`} tone={scorecard.edge > 0 ? "ok" : "bad"} />
              <Stat label={t("f1", ar)} value={`${scorecard.f1}%`} />
              <Stat label={t("brier", ar)} value={scorecard.brier.toFixed(3)} />
              <Stat label={`${t("precision", ar)} Buy/Sell`} value={`${scorecard.precisionBuy} / ${scorecard.precisionSell}`} />
              <Stat label={`${t("recall", ar)} Up/Down`} value={`${scorecard.recallUp} / ${scorecard.recallDown}`} />
              <Stat label={`${t("resolved", ar)} / ${t("total", ar)}`} value={`${scorecard.resolved} / ${scorecard.total}`} />
              <Stat label={t("pending", ar)} value={String(scorecard.pending)} />
            </div>
          </TabsContent>

          <TabsContent value="calibration" className="mt-4 space-y-3">
            <div className="flex flex-wrap gap-3 text-sm">
              <Badge variant="outline">{t("reliability", ar)}: {calibration.reliability}</Badge>
              <Badge variant="outline">{t("ece", ar)}: {calibration.ece}</Badge>
              <Badge variant="outline">{t("overconf", ar)}: {calibration.overconfidence}%</Badge>
            </div>
            <div className="space-y-2">
              {calibration.buckets.map((b) => (
                <div key={b.range}>
                  <div className="flex justify-between text-xs text-muted-foreground"><span>{b.range}%</span><span>{b.accuracy}% ({b.count})</span></div>
                  <Progress value={b.accuracy} />
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="drift" className="mt-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Stat label={t("recent", ar)} value={`${drift.recentHitRate}%`} />
              <Stat label={t("baseline", ar)} value={`${drift.baselineHitRate}%`} />
              <Stat label={t("delta", ar)} value={`${drift.delta > 0 ? "+" : ""}${drift.delta}%`} tone={drift.status === "critical" ? "bad" : drift.status === "warning" ? "warn" : "ok"} />
              <Stat label={t("status", ar)} value={drift.status.toUpperCase()} tone={drift.status === "critical" ? "bad" : drift.status === "warning" ? "warn" : "ok"} />
            </div>
          </TabsContent>

          <TabsContent value="fp" className="mt-4 space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Stat label={t("fpRate", ar)} value={`${falsePositives.fpRate}%`} />
              <Stat label={t("fnRate", ar)} value={`${falsePositives.fnRate}%`} />
              <Stat label="FP" value={String(falsePositives.falsePositives)} />
              <Stat label="FN" value={String(falsePositives.falseNegatives)} />
            </div>
            <div className="space-y-1">
              {falsePositives.topOffendingAgents.map((a) => (
                <div key={a.agent} className="flex justify-between text-sm border-b py-1">
                  <span>{a.agent}</span><span className="text-muted-foreground">FP {a.fp} · FN {a.fn}</span>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="pnl" className="mt-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Stat label={t("cumPnl", ar)} value={`${performance.cumulativePnl}%`} tone={performance.cumulativePnl >= 0 ? "ok" : "bad"} />
              <Stat label={t("sharpe", ar)} value={performance.sharpe.toFixed(2)} />
              <Stat label={t("sortino", ar)} value={performance.sortino.toFixed(2)} />
              <Stat label={t("maxDD", ar)} value={`${performance.maxDrawdown}%`} tone="warn" />
              <Stat label={t("benchmark", ar)} value={`${performance.benchmarkPnl}%`} />
              <Stat label={t("excess", ar)} value={`${performance.excessReturn > 0 ? "+" : ""}${performance.excessReturn}%`} tone={performance.excessReturn >= 0 ? "ok" : "bad"} />
              <Stat label="W/L" value={String(performance.winLossRatio)} />
              <Stat label="Avg/trade" value={`${performance.avgReturnPerTrade}%`} />
            </div>
          </TabsContent>

          <TabsContent value="aging" className="mt-4 space-y-1">
            {aging.map((a) => (
              <div key={a.range} className="flex justify-between text-sm border-b py-1">
                <span>{t("ageBucket", ar)} {a.range}</span>
                <span className="text-muted-foreground">{a.count} · {a.hitRate}% · {a.avgReturn}%</span>
              </div>
            ))}
          </TabsContent>

          <TabsContent value="regime" className="mt-4 space-y-1">
            {regime.length === 0 ? <p className="text-sm text-muted-foreground">{t("empty", ar)}</p> :
              regime.map((r) => (
                <div key={r.regime} className="flex justify-between text-sm border-b py-1">
                  <span>{r.regime}</span>
                  <span className="text-muted-foreground">{r.count} · {r.hitRate}% · {r.avgReturn}%</span>
                </div>
              ))}
          </TabsContent>

          <TabsContent value="agents" className="mt-4 space-y-1">
            {agents.map((a) => (
              <div key={a.agent} className="flex justify-between text-sm border-b py-1">
                <span className="capitalize">{a.agent}</span>
                <span className="text-muted-foreground">{a.count} · {a.hitRate}% · S {a.sharpe} · B {a.brier}</span>
              </div>
            ))}
          </TabsContent>

          <TabsContent value="health" className="mt-4 space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <Stat label={t("hallu", ar)} value={`${(hallucination.rate * 100).toFixed(1)}%`} tone={hallucination.rate > 0.05 ? "bad" : "ok"} />
              <Stat label={t("flagged", ar)} value={String(hallucination.flagged)} />
              <Stat label={t("status", ar)} value={drift.status.toUpperCase()} tone={drift.status === "critical" ? "bad" : drift.status === "warning" ? "warn" : "ok"} />
            </div>
            <div className="space-y-1 text-sm">
              {hallucination.notes.length ? hallucination.notes.map((n, i) => (
                <div key={i} className="flex items-start gap-2 text-amber-600"><AlertTriangle className="h-4 w-4 mt-0.5" />{n}</div>
              )) : <p className="text-muted-foreground">{t("noNotes", ar)}</p>}
            </div>
          </TabsContent>
        </Tabs>
      )}
    </Card>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "ok" | "bad" | "warn" }) {
  const cls = tone === "ok" ? "text-emerald-500" : tone === "bad" ? "text-red-500" : tone === "warn" ? "text-amber-500" : "";
  return (
    <div className="rounded-md border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-lg font-semibold ${cls}`}>{value}</div>
    </div>
  );
}
