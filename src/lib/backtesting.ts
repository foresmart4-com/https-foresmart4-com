// Mock backtesting engine — pure deterministic, no network
export type BacktestStrategy = "conservative" | "balanced" | "aggressive";
export type BacktestPeriod = 7 | 30 | 90;

export type BacktestResult = {
  asset: string;
  strategy: BacktestStrategy;
  period: BacktestPeriod;
  trades: number;
  wins: number;
  losses: number;
  winRatePct: number;
  totalReturnPct: number;
  largestWinPct: number;
  largestLossPct: number;
  maxDrawdownPct: number;
  summary_ar: string;
  summary_en: string;
};

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = (h * 16777619) >>> 0; }
  return h;
}
function rng(seed: number) { return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return (seed & 0x7fffffff) / 0x7fffffff; }; }

const PARAMS: Record<BacktestStrategy, { trade: number; winBias: number; sizePct: number }> = {
  conservative: { trade: 0.25, winBias: 0.62, sizePct: 5 },
  balanced:     { trade: 0.45, winBias: 0.55, sizePct: 10 },
  aggressive:   { trade: 0.70, winBias: 0.48, sizePct: 15 },
};

export function runBacktest(asset: string, period: BacktestPeriod, strategy: BacktestStrategy): BacktestResult {
  const seed = hash(`${asset}|${period}|${strategy}`);
  const r = rng(seed);
  const p = PARAMS[strategy];
  let trades = 0, wins = 0, losses = 0;
  let equity = 100;
  let peak = 100, maxDD = 0;
  let bestWin = 0, worstLoss = 0;
  for (let i = 0; i < period; i++) {
    if (r() < p.trade) {
      trades++;
      const isWin = r() < p.winBias;
      const mag = (r() * 2.5 + 0.5) * (p.sizePct / 10);
      const pct = isWin ? mag : -mag * 1.05;
      equity *= 1 + pct / 100;
      if (isWin) { wins++; if (pct > bestWin) bestWin = pct; }
      else { losses++; if (pct < worstLoss) worstLoss = pct; }
      if (equity > peak) peak = equity;
      const dd = (peak - equity) / peak * 100;
      if (dd > maxDD) maxDD = dd;
    }
  }
  const totalReturnPct = equity - 100;
  const winRatePct = trades > 0 ? (wins / trades) * 100 : 0;
  return {
    asset, strategy, period, trades, wins, losses,
    winRatePct: Number(winRatePct.toFixed(1)),
    totalReturnPct: Number(totalReturnPct.toFixed(2)),
    largestWinPct: Number(bestWin.toFixed(2)),
    largestLossPct: Number(worstLoss.toFixed(2)),
    maxDrawdownPct: Number(maxDD.toFixed(2)),
    summary_ar:
      strategy === "conservative" ? "استراتيجية محافظة: صفقات أقل وثقة أعلى."
      : strategy === "balanced" ? "استراتيجية متوازنة بين عدد الصفقات والمخاطر."
      : "استراتيجية هجومية: صفقات أكثر وتقلب أعلى.",
    summary_en:
      strategy === "conservative" ? "Conservative: fewer trades, higher confidence."
      : strategy === "balanced" ? "Balanced trade frequency vs risk."
      : "Aggressive: more trades, higher volatility.",
  };
}
