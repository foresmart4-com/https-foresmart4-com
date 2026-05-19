import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { aiMemory } from "@/services/learning/aiMemory";
import {
  agentScores,
  strategyScores,
  calibration,
  ece,
  driftReport,
  replay,
  memorySummary,
  metaTuneThreshold,
  failureAnalysis,
  falsePositives,
  regimeStatsSince,
  overallStats,
} from "@/services/learning/selfLearningEngine";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  GraduationCap, Target, Activity, TrendingUp, Award, AlertTriangle,
  Brain, Trophy, Gauge, LineChart as LineIcon, Zap, ShieldAlert, Radar,
} from "lucide-react";

export const Route = createFileRoute("/_app/ai-learning")({
  component: AILearningPage,
  head: () => ({
    meta: [
      { title: "AI Learning — ForeSmart" },
      { name: "description", content: "Self-learning AI: outcome tracking, calibration, drift detection, strategy ranking, agent scorecards, meta-learning." },
    ],
  }),
});

type RangeKey = "24h" | "7d" | "30d" | "all";
const RANGE_MS: Record<RangeKey, number | undefined> = {
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
  all: undefined,
};

function AILearningPage() {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const [tick, setTick] = useState(0);
  const [storageKey, setStorageKey] = useState<string>("foresmart.ai-learning.range:anon");
  const [range, setRangeState] = useState<RangeKey>(() => {
    if (typeof window === "undefined") return "7d";
    const v = window.localStorage.getItem("foresmart.ai-learning.range:anon");
    return (v === "24h" || v === "7d" || v === "30d" || v === "all") ? v : "7d";
  });
  const setRange = (v: RangeKey) => {
    setRangeState(v);
    try { window.localStorage.setItem(storageKey, v); } catch {}
  };

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getUser().then(({ data }) => {
      if (cancelled) return;
      const key = `foresmart.ai-learning.range:${data.user?.id ?? "anon"}`;
      setStorageKey(key);
      try {
        const v = window.localStorage.getItem(key);
        if (v === "24h" || v === "7d" || v === "30d" || v === "all") setRangeState(v);
      } catch {}
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      const key = `foresmart.ai-learning.range:${session?.user?.id ?? "anon"}`;
      setStorageKey(key);
      try {
        const v = window.localStorage.getItem(key);
        if (v === "24h" || v === "7d" || v === "30d" || v === "all") setRangeState(v);
      } catch {}
    });
    return () => { cancelled = true; sub.subscription.unsubscribe(); };
  }, []);

  const data = useMemo(() => {
    const since = RANGE_MS[range];
    const all = aiMemory.list();
    const recent = since ? all.filter((r) => r.ts >= Date.now() - since) : all;
    return {
      rows: recent,
      overall: overallStats(since),
      byRegime: regimeStatsSince(since),
      recent: recent.slice(0, 20),
      agents: agentScores(since),
      strategies: strategyScores(since),
      cal: calibration(since),
      eceVal: ece(since),
      drift: driftReport(30, since),
      sim: replay(undefined, since),
      mem: memorySummary(since),
      meta: metaTuneThreshold(since),
      failures: failureAnalysis(10, since),
      fps: falsePositives(since),
    };
    // re-runs when tick (Refresh) or range changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, range]);

  const { overall, byRegime, recent, agents, strategies, cal, eceVal, drift, sim, mem, meta, failures, fps } = data;

  return (
    <div className="container mx-auto max-w-7xl space-y-4 p-4 sm:p-6">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <GraduationCap className="h-5 w-5 text-primary" />
            {ar ? "تعلّم الذكاء الاصطناعي" : "AI Learning Layer"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {ar
              ? "تتبّع النتائج، معايرة الثقة، تعزيز، ترتيب الاستراتيجيات، تكيّف مع النظام، كشف الانحراف، وزن العملاء، إعادة محاكاة، وتحسين ميتا."
              : "Outcome tracking · calibration · reinforcement · strategy ranking · regime adaptation · drift detection · agent weighting · replay · meta-tuning."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Tabs value={range} onValueChange={(v) => setRange(v as RangeKey)}>
            <TabsList className="h-8">
              <TabsTrigger value="24h" className="text-xs px-2 py-0.5">24h</TabsTrigger>
              <TabsTrigger value="7d" className="text-xs px-2 py-0.5">7d</TabsTrigger>
              <TabsTrigger value="30d" className="text-xs px-2 py-0.5">30d</TabsTrigger>
              <TabsTrigger value="all" className="text-xs px-2 py-0.5">{ar ? "الكل" : "All"}</TabsTrigger>
            </TabsList>
          </Tabs>
          <Button size="sm" variant="outline" onClick={() => setTick((t) => t + 1)}>
            {ar ? "تحديث" : "Refresh"}
          </Button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground -mt-2">
        {ar
          ? `النطاق الزمني: ${range === "all" ? "الكل" : range} · ${data.rows.length} سجل`
          : `Range: ${range} · ${data.rows.length} entries in window`}
      </p>

      {/* KPIs */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        <Stat icon={<Target className="h-4 w-4" />} label={ar ? "الصفقات" : "Trades"} value={overall.trades.toString()} />
        <Stat icon={<Award className="h-4 w-4" />} label={ar ? "معدل الفوز" : "Win Rate"} value={`${Math.round(overall.winRate * 100)}%`} />
        <Stat icon={<TrendingUp className="h-4 w-4" />} label={ar ? "التوقع" : "Expectancy"} value={overall.expectancy.toFixed(2)} />
        <Stat icon={<Activity className="h-4 w-4" />} label={ar ? "عامل الربح" : "Profit Factor"} value={overall.profitFactor.toFixed(2)} />
      </div>

      {/* Drift + Meta + Calibration summary */}
      <div className="grid gap-3 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Radar className="h-4 w-4 text-primary" />
              {ar ? "كشف الانحراف" : "Drift Detection"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">{ar ? "الحالة" : "Status"}</span>
              <Badge variant={drift.isDrifting ? "destructive" : "outline"}>
                {drift.isDrifting ? (ar ? "انحراف" : "Drifting") : (ar ? "مستقر" : "Stable")}
              </Badge>
            </div>
            <Row label={ar ? "حديث" : "Recent WR"} val={`${Math.round(drift.recentWinRate * 100)}%`} />
            <Row label={ar ? "الأساس" : "Baseline"} val={`${Math.round(drift.baselineWinRate * 100)}%`} />
            <Row label="Δ" val={`${(drift.delta * 100).toFixed(1)}%`} />
            <Row label="z" val={drift.z.toFixed(2)} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Gauge className="h-4 w-4 text-primary" />
              {ar ? "معايرة الثقة" : "Confidence Calibration"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <Row label="ECE" val={(eceVal * 100).toFixed(2) + "%"} />
            <p className="text-xs text-muted-foreground">
              {ar ? "كلما اقترب من 0% كانت الثقة أكثر صدقاً." : "Closer to 0% = better-calibrated confidence."}
            </p>
            <div className="grid grid-cols-10 gap-0.5 pt-1">
              {cal.map((b) => (
                <div
                  key={b.bucket}
                  title={`${b.bucket}: pred ${(b.predicted * 100).toFixed(0)}% / obs ${(b.observed * 100).toFixed(0)}% (n=${b.count})`}
                  className="h-8 rounded-sm border"
                  style={{
                    background: b.count
                      ? `color-mix(in oklab, var(--primary) ${Math.round(b.observed * 100)}%, transparent)`
                      : "transparent",
                  }}
                />
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Brain className="h-4 w-4 text-primary" />
              {ar ? "تحسين ميتا" : "Meta-Learning"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <Row label={ar ? "حدّ الثقة الأمثل" : "Optimal threshold"} val={`${Math.round(meta.threshold * 100)}%`} />
            <Row label={ar ? "توقع جديد" : "New expectancy"} val={meta.expectancy.toFixed(3)} />
            <Row label={ar ? "تحسن" : "Improvement"} val={`${(meta.improvement * 100).toFixed(2)}%`} />
            <p className="text-xs text-muted-foreground">
              {ar ? "تصفية التوصيات تحت هذا الحدّ يحسن الأداء." : "Filtering recs below this threshold improves edge."}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Strategy leaderboard + Agent scorecards */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Trophy className="h-4 w-4 text-primary" />
              {ar ? "لوحة شرف الاستراتيجيات" : "Strategy Leaderboard"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {strategies.length === 0 ? (
              <p className="text-sm text-muted-foreground">{ar ? "لا توجد بيانات بعد." : "No data yet."}</p>
            ) : (
              strategies.map((s) => (
                <div key={s.strategy} className="rounded-md border p-2 space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium flex items-center gap-2">
                      <Badge variant="outline">#{s.rank}</Badge>
                      {s.strategy}
                    </span>
                    <Badge>{(s.weight * 100).toFixed(0)}%</Badge>
                  </div>
                  <Progress value={Math.min(100, s.winRate * 100)} className="h-1.5" />
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                    <span>{s.trades} {ar ? "صفقة" : "trades"}</span>
                    <span>WR {Math.round(s.winRate * 100)}%</span>
                    <span>PF {s.profitFactor.toFixed(2)}</span>
                    <span>E {s.expectancy.toFixed(2)}</span>
                    <span>Sharpe {s.sharpe.toFixed(2)}</span>
                    {s.bestRegime && <span>{ar ? "أفضل نظام" : "best regime"}: {s.bestRegime}</span>}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" />
              {ar ? "بطاقات أداء العملاء" : "Agent Scorecards"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {agents.length === 0 ? (
              <p className="text-sm text-muted-foreground">{ar ? "لا توجد بيانات بعد." : "No data yet."}</p>
            ) : (
              agents.map((a) => (
                <div key={a.agent} className="rounded-md border p-2 space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium capitalize">{a.agent}</span>
                    <div className="flex items-center gap-1">
                      <Badge variant="outline">{Math.round(a.winRate * 100)}%</Badge>
                      <Badge>{(a.weight * 100).toFixed(0)}%</Badge>
                    </div>
                  </div>
                  <Progress value={Math.min(100, a.winRate * 100)} className="h-1.5" />
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                    <span>{a.trades} {ar ? "صفقة" : "trades"}</span>
                    <span>PF {a.profitFactor.toFixed(2)}</span>
                    <span>E {a.expectancy.toFixed(2)}</span>
                    <span>Sharpe {a.sharpe.toFixed(2)}</span>
                    <span>R {a.reinforcement.toFixed(2)}</span>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Replay + Regime */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <LineIcon className="h-4 w-4 text-primary" />
              {ar ? "إعادة محاكاة تاريخية" : "Historical Replay"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="grid grid-cols-4 gap-2 text-xs">
              <Mini label={ar ? "صفقات" : "Trades"} val={sim.trades.toString()} />
              <Mini label="WR" val={`${Math.round(sim.winRate * 100)}%`} />
              <Mini label="PF" val={sim.profitFactor.toFixed(2)} />
              <Mini label="DD" val={`${sim.maxDD.toFixed(1)}%`} />
            </div>
            <EquitySpark equity={sim.equity} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{ar ? "أداء حسب النظام السوقي" : "Regime-Aware Performance"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {Object.keys(byRegime).length === 0 && (
              <p className="text-sm text-muted-foreground">{ar ? "لا توجد بيانات بعد." : "No data yet."}</p>
            )}
            {Object.entries(byRegime).map(([regime, s]) => (
              <div key={regime} className="rounded-md border p-2 space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium capitalize">{regime}</span>
                  <Badge variant="outline">{s.trades} {ar ? "صفقة" : "trades"}</Badge>
                </div>
                <Progress value={s.winRate * 100} className="h-1.5" />
                <div className="flex gap-3 text-xs text-muted-foreground">
                  <span>WR {Math.round(s.winRate * 100)}%</span>
                  <span>PF {s.profitFactor.toFixed(2)}</span>
                  <span>E {s.expectancy.toFixed(2)}</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Failure & False positives */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              {ar ? "تحليل الإخفاقات" : "Failure Analysis"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {failures.length === 0 ? (
              <p className="text-sm text-muted-foreground">{ar ? "لا توجد إخفاقات بعد." : "No failures yet."}</p>
            ) : (
              <div className="space-y-1 text-xs">
                {failures.map((f) => (
                  <div key={f.id} className="flex items-center justify-between rounded border p-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{f.symbol}</Badge>
                      <Badge variant="destructive">{f.side}</Badge>
                      <span className="text-muted-foreground">{f.reason}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">c {Math.round(f.confidence * 100)}%</span>
                      <span className="text-destructive font-medium">{f.pnlPct.toFixed(2)}%</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-destructive" />
              {ar ? "إيجابيات كاذبة" : "False Positives"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {fps.length === 0 ? (
              <p className="text-sm text-muted-foreground">{ar ? "لا توجد إيجابيات كاذبة." : "No false positives detected."}</p>
            ) : (
              <div className="space-y-1 text-xs">
                {fps.map((f) => (
                  <div key={f.id} className="flex items-center justify-between rounded border p-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{f.symbol}</Badge>
                      <span className="text-muted-foreground">{f.strategy ?? "—"} · {f.agent ?? "—"}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge>{Math.round(f.confidence * 100)}%</Badge>
                      <span className="text-destructive font-medium">{f.pnlPct.toFixed(2)}%</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent trades */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{ar ? "أحدث الصفقات (ذاكرة مستمرة)" : "Recent Trades (Continuous Memory)"}</CardTitle>
        </CardHeader>
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
        {ar
          ? `الذاكرة: ${mem.total} سجل · ${mem.closed} مغلق · ${mem.open} مفتوح · ${mem.spanDays} يوم`
          : `Memory: ${mem.total} entries · ${mem.closed} closed · ${mem.open} open · ${mem.spanDays}d span`}
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

function Row({ label, val }: { label: string; val: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums">{val}</span>
    </div>
  );
}

function Mini({ label, val }: { label: string; val: string }) {
  return (
    <div className="rounded-md border p-2 text-center">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="font-semibold tabular-nums">{val}</div>
    </div>
  );
}

function EquitySpark({ equity }: { equity: number[] }) {
  if (!equity.length) {
    return <div className="h-16 rounded-md border bg-muted/20 grid place-items-center text-xs text-muted-foreground">no equity data</div>;
  }
  const w = 320, h = 56, pad = 4;
  const min = Math.min(...equity, 0);
  const max = Math.max(...equity, 0);
  const range = max - min || 1;
  const step = (w - pad * 2) / Math.max(1, equity.length - 1);
  const pts = equity.map((v, i) => `${pad + i * step},${h - pad - ((v - min) / range) * (h - pad * 2)}`).join(" ");
  const last = equity[equity.length - 1];
  const stroke = last >= 0 ? "hsl(var(--primary))" : "hsl(var(--destructive))";
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-16">
      <polyline fill="none" stroke={stroke} strokeWidth="1.5" points={pts} />
    </svg>
  );
}
