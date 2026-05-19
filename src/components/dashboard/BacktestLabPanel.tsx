import { useMemo, useState, useTransition } from "react";
import {
  generateBars, replayHistorical, builtinStrategies,
  benchmarkStrategies, testAcrossRegimes, calibrate, analyzeAIAccuracy,
  simulatePortfolio, exportReplayCsv, exportReplayJson, exportBenchmarkCsv,
  type RegimeName,
} from "@/services/backtest";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useI18n } from "@/lib/i18n";

const STRATS = Object.keys(builtinStrategies) as (keyof typeof builtinStrategies)[];
const REGIMES: RegimeName[] = ["bull", "bear", "chop", "volatile", "crisis"];

export function BacktestLabPanel() {
  const { t } = useI18n();
  const [strategy, setStrategy] = useState<keyof typeof builtinStrategies>("trendFollow");
  const [regime, setRegime] = useState<RegimeName>("bull");
  const [bars, setBars] = useState(252);
  const [seed, setSeed] = useState(42);
  const [pending, start] = useTransition();
  const [tick, setTick] = useState(0);

  const data = useMemo(() => generateBars({ bars, regime, seed }), [bars, regime, seed, tick]);
  const replay = useMemo(() => replayHistorical(data, builtinStrategies[strategy]), [data, strategy]);
  const calibration = useMemo(() => calibrate(replay.decisions), [replay]);
  const ai = useMemo(() => analyzeAIAccuracy(replay.decisions), [replay]);
  const benchmark = useMemo(() => benchmarkStrategies(data), [data]);
  const regimeTest = useMemo(() => testAcrossRegimes(builtinStrategies[strategy], { bars, seed }), [strategy, bars, seed]);
  const portfolio = useMemo(() => {
    const legs = STRATS.slice(0, 4).map((s, i) => ({
      symbol: s, bars: generateBars({ bars, regime, seed: seed + i + 1 }),
      weight: 0.25, strategy: builtinStrategies[s],
    }));
    return simulatePortfolio(legs);
  }, [bars, regime, seed]);

  const m = replay.metrics;

  return (
    <Card className="border-primary/20 shadow-lg">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle className="text-xl">{t("backtest.title")}</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">{t("backtest.subtitle")}</p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => exportReplayCsv(replay, `${strategy}-${regime}`)}>
              {t("backtest.exportCsv")}
            </Button>
            <Button size="sm" variant="outline" onClick={() => exportReplayJson(replay, `${strategy}-${regime}`)}>
              {t("backtest.exportJson")}
            </Button>
            <Button size="sm" variant="outline" onClick={() => exportBenchmarkCsv(benchmark, "benchmark")}>
              {t("backtest.benchmark")} CSV
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
          <Field label={t("backtest.strategy")}>
            <select className="w-full rounded-md border bg-background px-2 py-1.5"
              value={strategy} onChange={(e) => setStrategy(e.target.value as keyof typeof builtinStrategies)}>
              {STRATS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
          <Field label={t("backtest.regime")}>
            <select className="w-full rounded-md border bg-background px-2 py-1.5"
              value={regime} onChange={(e) => setRegime(e.target.value as RegimeName)}>
              {REGIMES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </Field>
          <Field label={t("backtest.bars")}>
            <input type="number" min={50} max={2000} value={bars}
              onChange={(e) => setBars(Math.max(50, Math.min(2000, +e.target.value || 252)))}
              className="w-full rounded-md border bg-background px-2 py-1.5" />
          </Field>
          <Field label={t("backtest.seed")}>
            <input type="number" value={seed}
              onChange={(e) => setSeed(+e.target.value || 0)}
              className="w-full rounded-md border bg-background px-2 py-1.5" />
          </Field>
          <div className="flex items-end">
            <Button className="w-full" disabled={pending}
              onClick={() => start(() => setTick((x) => x + 1))}>
              {pending ? t("backtest.running") : t("backtest.run")}
            </Button>
          </div>
        </div>

        <Tabs defaultValue="performance" className="w-full">
          <TabsList className="grid grid-cols-2 md:grid-cols-5 w-full">
            <TabsTrigger value="performance">{t("backtest.metrics")}</TabsTrigger>
            <TabsTrigger value="ai">{t("backtest.accuracy")}</TabsTrigger>
            <TabsTrigger value="calibration">{t("backtest.calibration")}</TabsTrigger>
            <TabsTrigger value="benchmark">{t("backtest.benchmark")}</TabsTrigger>
            <TabsTrigger value="regime">{t("backtest.regimeTest")}</TabsTrigger>
          </TabsList>

          <TabsContent value="performance" className="mt-4 space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Stat label={t("backtest.totalReturn")} value={`${m.totalReturnPct}%`} tone={m.totalReturnPct >= 0 ? "pos" : "neg"} />
              <Stat label={t("backtest.sharpe")} value={m.sharpe.toFixed(2)} />
              <Stat label={t("backtest.sortino")} value={m.sortino.toFixed(2)} />
              <Stat label={t("backtest.calmar")} value={m.calmar.toFixed(2)} />
              <Stat label={t("backtest.maxDd")} value={`${m.maxDrawdownPct}%`} tone="neg" />
              <Stat label="Volatility" value={`${m.volatilityPct}%`} />
              <Stat label="Ulcer Index" value={m.ulcerIndex.toFixed(2)} />
              <Stat label={t("backtest.winRate")} value={`${replay.winRate}%`} />
            </div>
            <div className="rounded-lg border p-3">
              <div className="text-xs text-muted-foreground mb-2">{t("backtest.portfolio")}</div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Stat label={t("backtest.totalReturn")} value={`${portfolio.metrics.totalReturnPct}%`} tone={portfolio.metrics.totalReturnPct >= 0 ? "pos" : "neg"} />
                <Stat label={t("backtest.sharpe")} value={portfolio.metrics.sharpe.toFixed(2)} />
                <Stat label={t("backtest.maxDd")} value={`${portfolio.metrics.maxDrawdownPct}%`} tone="neg" />
                <Stat label={t("backtest.diversification")} value={`${portfolio.diversificationScore}%`} />
              </div>
              <table className="w-full text-xs mt-3">
                <thead className="text-muted-foreground">
                  <tr><th className="text-left py-1">Asset</th><th className="text-right">Weight</th><th className="text-right">Trades</th><th className="text-right">Win%</th><th className="text-right">Contrib%</th></tr>
                </thead>
                <tbody>
                  {portfolio.perAsset.map((p) => (
                    <tr key={p.symbol} className="border-t">
                      <td className="py-1">{p.symbol}</td>
                      <td className="text-right">{(p.weight * 100).toFixed(1)}%</td>
                      <td className="text-right">{p.trades}</td>
                      <td className="text-right">{p.winRate}%</td>
                      <td className={`text-right ${p.contributionPct >= 0 ? "text-emerald-500" : "text-rose-500"}`}>{p.contributionPct}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TabsContent>

          <TabsContent value="ai" className="mt-4 space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Stat label={t("backtest.hitRate")} value={`${ai.hitRate}%`} tone={ai.hitRate >= 55 ? "pos" : "neg"} />
              <Stat label={t("backtest.edge")} value={`${ai.edge > 0 ? "+" : ""}${ai.edge}%`} tone={ai.edge >= 0 ? "pos" : "neg"} />
              <Stat label={t("backtest.f1")} value={`${ai.f1}%`} />
              <Stat label="High-Conf Hit" value={`${ai.highConfidenceHitRate}%`} />
              <Stat label="Precision Buy" value={`${ai.precisionBuy}%`} />
              <Stat label="Precision Sell" value={`${ai.precisionSell}%`} />
              <Stat label="Recall Up" value={`${ai.recallUp}%`} />
              <Stat label="Recall Down" value={`${ai.recallDown}%`} />
            </div>
            <p className="text-xs text-muted-foreground">
              {ai.actionable} actionable decisions · avg conf right {ai.avgConfidenceWhenRight}% · wrong {ai.avgConfidenceWhenWrong}%
            </p>
          </TabsContent>

          <TabsContent value="calibration" className="mt-4 space-y-3">
            <div className="flex items-center gap-3 flex-wrap">
              <Badge variant={calibration.reliability === "excellent" || calibration.reliability === "good" ? "default" : "destructive"}>
                {t("backtest.reliability")}: {calibration.reliability}
              </Badge>
              <span className="text-sm">{t("backtest.ece")}: <b>{calibration.expectedCalibrationError}</b></span>
              <span className="text-sm">{t("backtest.brier")}: <b>{calibration.brierScore}</b></span>
              <span className="text-sm">{t("backtest.overconfidence")}: <b>{calibration.overconfidence}%</b></span>
            </div>
            <table className="w-full text-sm">
              <thead className="text-muted-foreground text-xs">
                <tr><th className="text-left py-1">Confidence</th><th className="text-right">Count</th><th className="text-right">Correct</th><th className="text-right">Accuracy</th></tr>
              </thead>
              <tbody>
                {calibration.buckets.map((b) => (
                  <tr key={b.range} className="border-t">
                    <td className="py-1">{b.range}</td>
                    <td className="text-right">{b.count}</td>
                    <td className="text-right">{b.correct}</td>
                    <td className="text-right">{b.accuracy}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TabsContent>

          <TabsContent value="benchmark" className="mt-4">
            <table className="w-full text-sm">
              <thead className="text-muted-foreground text-xs">
                <tr>
                  <th className="text-left py-1">#</th><th className="text-left">{t("backtest.strategy")}</th>
                  <th className="text-right">Return</th><th className="text-right">{t("backtest.sharpe")}</th>
                  <th className="text-right">{t("backtest.maxDd")}</th><th className="text-right">{t("backtest.winRate")}</th>
                  <th className="text-right">{t("backtest.score")}</th>
                </tr>
              </thead>
              <tbody>
                {benchmark.strategies.map((s) => (
                  <tr key={s.name} className="border-t">
                    <td className="py-1">{s.rank}</td>
                    <td className="font-medium">{s.name}</td>
                    <td className={`text-right ${s.result.metrics.totalReturnPct >= 0 ? "text-emerald-500" : "text-rose-500"}`}>{s.result.metrics.totalReturnPct}%</td>
                    <td className="text-right">{s.result.metrics.sharpe.toFixed(2)}</td>
                    <td className="text-right text-rose-500">{s.result.metrics.maxDrawdownPct}%</td>
                    <td className="text-right">{s.result.winRate}%</td>
                    <td className="text-right font-bold">{s.score}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TabsContent>

          <TabsContent value="regime" className="mt-4 space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <Stat label={t("backtest.robustness")} value={`${regimeTest.robustness}%`} tone={regimeTest.robustness >= 60 ? "pos" : "neg"} />
              <span className="text-sm">Best: <b>{regimeTest.bestRegime}</b> · Worst: <b>{regimeTest.worstRegime}</b></span>
            </div>
            <table className="w-full text-sm">
              <thead className="text-muted-foreground text-xs">
                <tr><th className="text-left py-1">Regime</th><th className="text-right">Return</th><th className="text-right">{t("backtest.sharpe")}</th><th className="text-right">{t("backtest.maxDd")}</th><th className="text-right">{t("backtest.winRate")}</th><th className="text-right">Rating</th></tr>
              </thead>
              <tbody>
                {regimeTest.results.map((r) => (
                  <tr key={r.regime} className="border-t">
                    <td className="py-1 capitalize">{r.regime}</td>
                    <td className={`text-right ${r.result.metrics.totalReturnPct >= 0 ? "text-emerald-500" : "text-rose-500"}`}>{r.result.metrics.totalReturnPct}%</td>
                    <td className="text-right">{r.result.metrics.sharpe.toFixed(2)}</td>
                    <td className="text-right text-rose-500">{r.result.metrics.maxDrawdownPct}%</td>
                    <td className="text-right">{r.result.winRate}%</td>
                    <td className="text-right">
                      <Badge variant={r.rating === "strong" ? "default" : r.rating === "weak" ? "destructive" : "secondary"}>{r.rating}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "pos" | "neg" }) {
  const color = tone === "pos" ? "text-emerald-500" : tone === "neg" ? "text-rose-500" : "text-foreground";
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`text-lg font-bold ${color}`}>{value}</div>
    </div>
  );
}

export default BacktestLabPanel;
