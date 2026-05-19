// Benchmark multiple strategies on the same bar history.
import type { Bar } from "./simulationLab";
import { replayHistorical, builtinStrategies, type StrategyFn, type ReplayResult } from "./historicalReplay";
import { calibrate, type CalibrationReport } from "./confidenceCalibration";

export interface StrategyBenchmark {
  name: string;
  result: ReplayResult;
  calibration: CalibrationReport;
  rank: number;
  score: number;
}

export interface BenchmarkReport {
  strategies: StrategyBenchmark[];
  best: string;
  worst: string;
  bars: number;
}

function compositeScore(r: ReplayResult, c: CalibrationReport): number {
  // weighted: return + sharpe - drawdown - calibration error
  const ret = r.metrics.totalReturnPct;
  const sharpe = r.metrics.sharpe * 10;
  const dd = r.metrics.maxDrawdownPct;
  const cal = c.expectedCalibrationError * 100;
  return +(ret + sharpe - dd - cal).toFixed(2);
}

export function benchmarkStrategies(
  bars: Bar[],
  strategies: Record<string, StrategyFn> = builtinStrategies,
): BenchmarkReport {
  const entries = Object.entries(strategies).map(([name, fn]) => {
    const result = replayHistorical(bars, fn);
    const calibration = calibrate(result.decisions);
    return { name, result, calibration, score: compositeScore(result, calibration), rank: 0 };
  });
  entries.sort((a, b) => b.score - a.score);
  entries.forEach((e, i) => (e.rank = i + 1));
  return {
    strategies: entries,
    best: entries[0]?.name ?? "n/a",
    worst: entries.at(-1)?.name ?? "n/a",
    bars: bars.length,
  };
}
