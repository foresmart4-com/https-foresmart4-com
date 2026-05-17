// Performance Analytics Engine — institutional-grade performance metrics.
import type { TradeAuditEntry } from "./tradeAudit";

export interface PerformanceReport {
  trades: number;
  closed: number;
  winRate: number;            // 0-100
  avgWinPct: number;
  avgLossPct: number;
  profitFactor: number;
  maxDrawdownPct: number;
  sharpeLike: number;
  avgLatencyMs: number;
  avgSlippagePct: number;
  executionQuality: number;   // 0-100
  byRegime: Record<string, { trades: number; winRate: number; avgPnl: number }>;
  aiAccuracyTrend: number[];  // last 10 windows
  hints: string[];
}

export function analyzePerformance(trades: TradeAuditEntry[]): PerformanceReport {
  const closed = trades.filter((t) => typeof t.pnl === "number");
  const wins = closed.filter((t) => (t.pnl ?? 0) > 0);
  const losses = closed.filter((t) => (t.pnl ?? 0) < 0);

  const winRate = closed.length ? +(wins.length / closed.length * 100).toFixed(1) : 0;
  const avgWin = wins.length ? wins.reduce((a, t) => a + (t.pnl ?? 0), 0) / wins.length : 0;
  const avgLoss = losses.length ? losses.reduce((a, t) => a + Math.abs(t.pnl ?? 0), 0) / losses.length : 0;
  const profitFactor = avgLoss > 0 ? +(avgWin * wins.length / (avgLoss * losses.length || 1)).toFixed(2) : wins.length ? 99 : 0;

  // Equity curve from cumulative pnl
  let peak = 0, equity = 0, maxDd = 0;
  closed.slice().reverse().forEach((t) => {
    equity += t.pnl ?? 0;
    if (equity > peak) peak = equity;
    const dd = peak > 0 ? (peak - equity) / peak * 100 : 0;
    if (dd > maxDd) maxDd = dd;
  });

  // Sharpe-like = mean / stdev of pnl
  const pnls = closed.map((t) => t.pnl ?? 0);
  const mean = pnls.length ? pnls.reduce((a, b) => a + b, 0) / pnls.length : 0;
  const variance = pnls.length ? pnls.reduce((a, b) => a + (b - mean) ** 2, 0) / pnls.length : 0;
  const std = Math.sqrt(variance);
  const sharpeLike = std > 0 ? +(mean / std * Math.sqrt(252)).toFixed(2) : 0;

  const lat = trades.filter((t) => t.latencyMs).map((t) => t.latencyMs!);
  const slp = trades.filter((t) => t.slippagePct).map((t) => t.slippagePct!);
  const avgLatencyMs = lat.length ? Math.round(lat.reduce((a, b) => a + b, 0) / lat.length) : 0;
  const avgSlippagePct = slp.length ? +(slp.reduce((a, b) => a + b, 0) / slp.length).toFixed(3) : 0;
  const executionQuality = Math.max(0, Math.min(100, Math.round(
    100 - Math.min(40, avgLatencyMs / 20) - Math.min(40, avgSlippagePct * 200),
  )));

  // By regime
  const byRegime: PerformanceReport["byRegime"] = {};
  closed.forEach((t) => {
    const r = t.regime ?? "Unknown";
    byRegime[r] ??= { trades: 0, winRate: 0, avgPnl: 0 };
    byRegime[r].trades++;
    byRegime[r].avgPnl += t.pnl ?? 0;
  });
  Object.entries(byRegime).forEach(([k, v]) => {
    const wins = closed.filter((t) => (t.regime ?? "Unknown") === k && (t.pnl ?? 0) > 0).length;
    v.winRate = v.trades ? +(wins / v.trades * 100).toFixed(1) : 0;
    v.avgPnl = +(v.avgPnl / Math.max(1, v.trades)).toFixed(2);
  });

  // AI accuracy trend = rolling win-rate over last 10 windows of 5 trades
  const aiAccuracyTrend: number[] = [];
  for (let i = 0; i < Math.min(10, Math.floor(closed.length / 5)); i++) {
    const window = closed.slice(i * 5, i * 5 + 5);
    const w = window.filter((t) => (t.pnl ?? 0) > 0).length;
    aiAccuracyTrend.push(Math.round(w / window.length * 100));
  }

  const hints: string[] = [];
  if (winRate < 45 && closed.length >= 10) hints.push("Win-rate below 45% — tighten signal quality filter.");
  if (maxDd > 8) hints.push(`Max drawdown ${maxDd.toFixed(1)}% — reduce position sizing.`);
  if (profitFactor < 1.2 && closed.length >= 10) hints.push("Profit factor low — review exit ladder.");
  if (executionQuality < 60) hints.push("Execution quality degraded — investigate broker latency/slippage.");
  if (sharpeLike < 0.5 && closed.length >= 20) hints.push("Risk-adjusted return weak — favour higher-conviction setups.");

  return {
    trades: trades.length, closed: closed.length, winRate,
    avgWinPct: +avgWin.toFixed(2), avgLossPct: +avgLoss.toFixed(2),
    profitFactor, maxDrawdownPct: +maxDd.toFixed(2), sharpeLike,
    avgLatencyMs, avgSlippagePct, executionQuality,
    byRegime, aiAccuracyTrend, hints,
  };
}
