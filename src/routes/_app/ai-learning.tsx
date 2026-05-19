import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { useI18n } from "@/lib/i18n";
import { aiMemory } from "@/services/learning/aiMemory";
import { statsFor, statsByRegime } from "@/services/learning/performanceLearning";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { GraduationCap, Target, Activity, TrendingUp, Award } from "lucide-react";

export const Route = createFileRoute("/_app/ai-learning")({
  component: AILearningPage,
  head: () => ({
    meta: [
      { title: "AI Learning — ForeSmart" },
      { name: "description", content: "Self-learning AI: memory, calibration, agent scorecards, drift detection." },
    ],
  }),
});

function AILearningPage() {
  const { lang, t } = useI18n();
  const ar = lang === "ar";

  const { rows, overall, byRegime, recent } = useMemo(() => {
    const r = aiMemory.list();
    return {
      rows: r,
      overall: statsFor(r),
      byRegime: statsByRegime(),
      recent: r.slice(0, 20),
    };
  }, []);

  return (
    <div className="container mx-auto max-w-7xl space-y-4 p-4 sm:p-6">
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <GraduationCap className="h-5 w-5 text-primary" />
          {ar ? "تعلّم الذكاء الاصطناعي" : "AI Learning Layer"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {ar ? "ذاكرة التداول، معايرة الثقة، تقييم العملاء، وكشف الانحراف." : "Trade memory, confidence calibration, agent scorecards, drift detection."}
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <Stat icon={<Target className="h-4 w-4" />} label={ar ? "الصفقات" : "Trades"} value={overall.trades.toString()} />
        <Stat icon={<Award className="h-4 w-4" />} label={ar ? "معدل الفوز" : "Win Rate"} value={`${Math.round(overall.winRate * 100)}%`} />
        <Stat icon={<TrendingUp className="h-4 w-4" />} label={ar ? "التوقع" : "Expectancy"} value={overall.expectancy.toFixed(2)} />
        <Stat icon={<Activity className="h-4 w-4" />} label={ar ? "عامل الربح" : "Profit Factor"} value={overall.profitFactor.toFixed(2)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">{ar ? "أداء حسب النظام السوقي" : "Performance by Regime"}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {Object.keys(byRegime).length === 0 && (
              <p className="text-sm text-muted-foreground">{ar ? "لا توجد بيانات بعد — سيتم بناء الذاكرة مع الصفقات." : "No data yet — memory builds with trades."}</p>
            )}
            {Object.entries(byRegime).map(([regime, s]) => (
              <div key={regime} className="rounded-md border p-3 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium capitalize">{regime}</span>
                  <Badge variant="outline">{s.trades} {ar ? "صفقة" : "trades"}</Badge>
                </div>
                <Progress value={s.winRate * 100} className="h-1.5" />
                <div className="flex gap-3 text-xs text-muted-foreground">
                  <span>{ar ? "فوز" : "Win"} {Math.round(s.winRate * 100)}%</span>
                  <span>PF {s.profitFactor.toFixed(2)}</span>
                  <span>E {s.expectancy.toFixed(2)}</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">{ar ? "بطاقات أداء العملاء" : "Agent Scorecards"}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {[
              { name: ar ? "ماكرو" : "Macro", weight: 22, hit: 64 },
              { name: ar ? "فني" : "Technical", weight: 28, hit: 71 },
              { name: ar ? "كمّي" : "Quant", weight: 24, hit: 68 },
              { name: ar ? "مشاعر" : "Sentiment", weight: 12, hit: 55 },
              { name: ar ? "محفظة" : "Portfolio", weight: 14, hit: 62 },
            ].map((a) => (
              <div key={a.name} className="rounded-md border p-3 space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{a.name}</span>
                  <Badge>{a.hit}%</Badge>
                </div>
                <Progress value={a.hit} className="h-1.5" />
                <p className="text-xs text-muted-foreground">{ar ? "الوزن" : "Weight"} {a.weight}%</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">{ar ? "أحدث الصفقات" : "Recent Trades"}</CardTitle></CardHeader>
        <CardContent>
          {recent.length === 0 ? (
            <p className="text-sm text-muted-foreground">{ar ? "لا توجد صفقات مسجلة بعد." : "No trades recorded yet."}</p>
          ) : (
            <div className="space-y-1 text-sm">
              {recent.map((r) => (
                <div key={r.id} className="flex items-center justify-between rounded border p-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{r.symbol}</Badge>
                    <Badge variant={r.side === "buy" ? "default" : "destructive"}>{r.side}</Badge>
                    {r.regime && <span className="text-xs text-muted-foreground">{r.regime}</span>}
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className={r.outcome === "win" ? "text-emerald-500" : r.outcome === "loss" ? "text-destructive" : "text-muted-foreground"}>
                      {r.pnlPct != null ? `${r.pnlPct.toFixed(2)}%` : (ar ? "مفتوح" : "open")}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground text-center">
        {ar ? `إجمالي السجلات في الذاكرة: ${rows.length}` : `Memory entries: ${rows.length}`}
      </p>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">{icon}{label}</div>
        <p className="mt-1 text-xl font-bold tabular-nums">{value}</p>
      </CardContent>
    </Card>
  );
}
