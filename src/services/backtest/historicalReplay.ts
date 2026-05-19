// Historical replay engine — steps through bars yielding state for AI decision replay.
import type { Bar, Signal } from "./simulationLab";
import { computeRiskMetrics, type EquityPoint, type RiskMetrics } from "./riskMetrics";

export interface ReplayDecision {
  ts: number;
  bar: Bar;
  action: "buy" | "sell" | "hold";
  confidence: number;     // 0..100
  reasoning: string;
  predictedDirection: "up" | "down" | "flat";
  actualDirection?: "up" | "down" | "flat";
  correct?: boolean;
}

export interface ReplayTrade {
  entryTs: number; exitTs: number;
  entry: number; exit: number;
  side: "long" | "short";
  pnlPct: number;
  bars: number;
  confidence: number;
  win: boolean;
}

export interface ReplayResult {
  decisions: ReplayDecision[];
  trades: ReplayTrade[];
  equityCurve: EquityPoint[];
  signals: Signal[];
  metrics: RiskMetrics;
  wins: number;
  losses: number;
  winRate: number;
  expectancyPct: number;
}

export type StrategyFn = (window: Bar[]) => { action: "buy" | "sell" | "hold"; confidence: number; reasoning: string };

export const builtinStrategies: Record<string, StrategyFn> = {
  momentum: (w) => {
    if (w.length < 6) return { action: "hold", confidence: 30, reasoning: "insufficient history" };
    const last = w.at(-1)!.close, prev = w[w.length - 4].close;
    const mom = (last - prev) / prev;
    const conf = Math.min(95, 40 + Math.abs(mom) * 4000);
    if (mom > 0.003) return { action: "buy", confidence: conf, reasoning: `momentum +${(mom * 100).toFixed(2)}%` };
    if (mom < -0.003) return { action: "sell", confidence: conf, reasoning: `momentum ${(mom * 100).toFixed(2)}%` };
    return { action: "hold", confidence: 35, reasoning: "neutral momentum" };
  },
  meanReversion: (w) => {
    if (w.length < 20) return { action: "hold", confidence: 30, reasoning: "warming up" };
    const closes = w.slice(-20).map((b) => b.close);
    const avg = closes.reduce((s, x) => s + x, 0) / closes.length;
    const last = w.at(-1)!.close;
    const dev = (last - avg) / avg;
    const conf = Math.min(95, 40 + Math.abs(dev) * 1200);
    if (dev > 0.02) return { action: "sell", confidence: conf, reasoning: `+${(dev * 100).toFixed(2)}% over SMA20` };
    if (dev < -0.02) return { action: "buy", confidence: conf, reasoning: `${(dev * 100).toFixed(2)}% below SMA20` };
    return { action: "hold", confidence: 40, reasoning: "near mean" };
  },
  breakout: (w) => {
    if (w.length < 22) return { action: "hold", confidence: 30, reasoning: "warming up" };
    const win = w.slice(-21, -1);
    const hi = Math.max(...win.map((b) => b.high));
    const lo = Math.min(...win.map((b) => b.low));
    const last = w.at(-1)!.close;
    if (last > hi) return { action: "buy", confidence: 80, reasoning: `breakout > ${hi.toFixed(2)}` };
    if (last < lo) return { action: "sell", confidence: 80, reasoning: `breakdown < ${lo.toFixed(2)}` };
    return { action: "hold", confidence: 35, reasoning: "inside range" };
  },
  trendFollow: (w) => {
    if (w.length < 50) return { action: "hold", confidence: 30, reasoning: "warming up" };
    const sma = (n: number) => w.slice(-n).reduce((s, b) => s + b.close, 0) / n;
    const fast = sma(10), slow = sma(50);
    const diff = (fast - slow) / slow;
    const conf = Math.min(95, 45 + Math.abs(diff) * 800);
    if (fast > slow) return { action: "buy", confidence: conf, reasoning: `fast/slow MA +${(diff * 100).toFixed(2)}%` };
    if (fast < slow) return { action: "sell", confidence: conf, reasoning: `fast/slow MA ${(diff * 100).toFixed(2)}%` };
    return { action: "hold", confidence: 35, reasoning: "MA crossover neutral" };
  },
};

export function replayHistorical(
  bars: Bar[],
  strategy: StrategyFn,
  opts: { startEquity?: number; warmup?: number } = {},
): ReplayResult {
  const { startEquity = 10_000, warmup = 20 } = opts;
  const decisions: ReplayDecision[] = [];
  const trades: ReplayTrade[] = [];
  const signals: Signal[] = [];
  const curve: EquityPoint[] = [];

  let cash = startEquity, pos = 0, entry = 0, entryTs = 0, entryConf = 0, entryIdx = 0;

  for (let i = 0; i < bars.length; i++) {
    const bar = bars[i];
    const next = bars[i + 1];
    let action: "buy" | "sell" | "hold" = "hold";
    let confidence = 30;
    let reasoning = "warmup";
    if (i >= warmup) {
      const out = strategy(bars.slice(0, i + 1));
      action = out.action; confidence = out.confidence; reasoning = out.reasoning;
    }
    const predicted: "up" | "down" | "flat" =
      action === "buy" ? "up" : action === "sell" ? "down" : "flat";
    const actual: "up" | "down" | "flat" = next
      ? (next.close > bar.close ? "up" : next.close < bar.close ? "down" : "flat")
      : "flat";
    const correct = predicted !== "flat" && predicted === actual;
    decisions.push({ ts: bar.ts, bar, action, confidence, reasoning,
      predictedDirection: predicted, actualDirection: actual, correct });

    if (action === "buy" && pos === 0) {
      pos = cash / bar.close; entry = bar.close; entryTs = bar.ts; entryConf = confidence; entryIdx = i; cash = 0;
      signals.push({ ts: bar.ts, side: "buy" });
    } else if (action === "sell" && pos > 0) {
      cash = pos * bar.close;
      const pnlPct = (bar.close - entry) / entry;
      trades.push({
        entryTs, exitTs: bar.ts, entry, exit: bar.close, side: "long",
        pnlPct: +(pnlPct * 100).toFixed(3),
        bars: i - entryIdx, confidence: entryConf, win: pnlPct > 0,
      });
      pos = 0;
      signals.push({ ts: bar.ts, side: "sell" });
    }
    curve.push({ ts: bar.ts, equity: cash + pos * bar.close });
  }

  const wins = trades.filter((t) => t.win).length;
  const losses = trades.length - wins;
  const winRate = trades.length ? wins / trades.length : 0;
  const avgWin = wins ? trades.filter((t) => t.win).reduce((s, t) => s + t.pnlPct, 0) / wins : 0;
  const avgLoss = losses ? trades.filter((t) => !t.win).reduce((s, t) => s + t.pnlPct, 0) / losses : 0;
  const expectancy = winRate * avgWin + (1 - winRate) * avgLoss;

  return {
    decisions, trades, equityCurve: curve, signals,
    metrics: computeRiskMetrics(curve),
    wins, losses,
    winRate: +(winRate * 100).toFixed(2),
    expectancyPct: +expectancy.toFixed(3),
  };
}
