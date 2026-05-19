// Export backtest reports as CSV/JSON (browser-safe).
import type { ReplayResult } from "./historicalReplay";
import type { BenchmarkReport } from "./strategyBenchmark";

function toCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.join(","), ...rows.map((r) => headers.map((h) => escape(r[h])).join(","))].join("\n");
}

function download(filename: string, content: string, mime: string) {
  if (typeof window === "undefined") return;
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportReplayCsv(result: ReplayResult, name = "backtest") {
  const trades = result.trades.map((t) => ({
    entry: new Date(t.entryTs).toISOString(),
    exit: new Date(t.exitTs).toISOString(),
    side: t.side,
    entryPrice: t.entry, exitPrice: t.exit,
    pnlPct: t.pnlPct, bars: t.bars, confidence: t.confidence, win: t.win,
  }));
  download(`${name}-trades.csv`, toCsv(trades), "text/csv");
}

export function exportReplayJson(result: ReplayResult, name = "backtest") {
  const payload = {
    generatedAt: new Date().toISOString(),
    metrics: result.metrics,
    summary: { wins: result.wins, losses: result.losses, winRate: result.winRate, expectancyPct: result.expectancyPct },
    trades: result.trades,
    decisions: result.decisions.slice(-500),
    equityCurve: result.equityCurve,
  };
  download(`${name}-report.json`, JSON.stringify(payload, null, 2), "application/json");
}

export function exportBenchmarkCsv(report: BenchmarkReport, name = "benchmark") {
  const rows = report.strategies.map((s) => ({
    rank: s.rank,
    strategy: s.name,
    totalReturnPct: s.result.metrics.totalReturnPct,
    sharpe: s.result.metrics.sharpe,
    sortino: s.result.metrics.sortino,
    calmar: s.result.metrics.calmar,
    maxDrawdownPct: s.result.metrics.maxDrawdownPct,
    winRate: s.result.winRate,
    trades: s.result.trades.length,
    calibrationError: s.calibration.expectedCalibrationError,
    reliability: s.calibration.reliability,
    score: s.score,
  }));
  download(`${name}.csv`, toCsv(rows), "text/csv");
}
