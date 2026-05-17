// Lightweight backtest engine — simulates rolling signal performance
// against the in-memory history buffer to surface accuracy, win rate
// and regime-conditional behaviour. No persistence, no async.
import type { MarketQuote, AssetKey } from "@/services/market/marketData";
import type { Signal } from "@/services/signals/signalEngine";
import type { RegimeReport } from "@/services/quant/regimeDetection";

export interface AssetPerformance {
  asset: AssetKey;
  assetName: string;
  trades: number;
  wins: number;
  winRate: number; // 0..100
  accuracy: number; // 0..100
  avgConfidence: number;
  avgVolatility: number;
}

export interface BacktestReport {
  perAsset: AssetPerformance[];
  overall: {
    trades: number;
    winRate: number;
    accuracy: number;
    avgConfidence: number;
    regime: string;
  };
  observations: string[];
}

function simulate(history: number[]): { wins: number; trades: number; accuracy: number } {
  // Simple strategy: if 3-period momentum > 0 we go long, else short,
  // then evaluate against next-bar direction.
  if (history.length < 6) return { wins: 0, trades: 0, accuracy: 0 };
  let wins = 0, trades = 0;
  for (let i = 4; i < history.length - 1; i++) {
    const mom = history[i] - history[i - 3];
    const next = history[i + 1] - history[i];
    if (mom === 0 || next === 0) continue;
    trades++;
    if (Math.sign(mom) === Math.sign(next)) wins++;
  }
  return { wins, trades, accuracy: trades ? +(wins / trades * 100).toFixed(1) : 0 };
}

export function runBacktest(
  quotes: MarketQuote[],
  signals: Signal[],
  regime: RegimeReport,
): BacktestReport {
  const sigMap = new Map(signals.map((s) => [s.asset, s]));
  const perAsset: AssetPerformance[] = quotes.map((q) => {
    const sim = simulate(q.history);
    const s = sigMap.get(q.key);
    return {
      asset: q.key,
      assetName: q.name,
      trades: sim.trades,
      wins: sim.wins,
      winRate: sim.accuracy,
      accuracy: sim.accuracy,
      avgConfidence: s?.confidence ?? 50,
      avgVolatility: +q.volatility.toFixed(1),
    };
  });

  const totalTrades = perAsset.reduce((s, p) => s + p.trades, 0);
  const totalWins = perAsset.reduce((s, p) => s + p.wins, 0);
  const winRate = totalTrades ? +(totalWins / totalTrades * 100).toFixed(1) : 0;
  const accuracy = winRate;
  const avgConfidence = perAsset.length
    ? +(perAsset.reduce((s, p) => s + p.avgConfidence, 0) / perAsset.length).toFixed(1)
    : 0;

  const observations: string[] = [];
  const top = [...perAsset].sort((a, b) => b.winRate - a.winRate)[0];
  const bot = [...perAsset].sort((a, b) => a.winRate - b.winRate)[0];
  if (top && top.trades > 0) observations.push(`${top.asset} leads with ${top.winRate}% historical hit-rate.`);
  if (bot && bot !== top && bot.trades > 0) observations.push(`${bot.asset} lags at ${bot.winRate}% — deprioritise until regime shifts.`);
  if (winRate >= 60) observations.push(`Strategy edge holds in current ${regime.regime} regime.`);
  else if (winRate < 45) observations.push(`Edge eroded in ${regime.regime} — favour smaller size or stand aside.`);
  if (avgConfidence > 75 && winRate < 55) observations.push("Model over-confident vs realised accuracy — calibration reducing exposure.");

  return {
    perAsset: perAsset.sort((a, b) => b.winRate - a.winRate),
    overall: { trades: totalTrades, winRate, accuracy, avgConfidence, regime: regime.regime },
    observations,
  };
}
