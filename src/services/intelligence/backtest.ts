import type { ScannedAsset } from "./marketScanner";
import { macd, rsi } from "./marketScanner";

export interface BacktestResult {
  symbol: string;
  trades: number;
  winRate: number; // %
  totalReturnPct: number;
  maxDrawdownPct: number;
  sharpe: number;
}

// Strategy: long when RSI<35 & MACD hist > 0, exit when RSI>65 or MACD hist<0.
export function backtestAsset(a: ScannedAsset): BacktestResult {
  const s = a.series;
  let inPos = false, entry = 0, peak = -Infinity, equity = 1, peakEq = 1, maxDD = 0;
  let wins = 0, trades = 0;
  const rets: number[] = [];
  for (let i = 30; i < s.length; i++) {
    const slice = s.slice(0, i + 1);
    const r = rsi(slice);
    const m = macd(slice).hist;
    if (!inPos && r < 35 && m > 0) { inPos = true; entry = slice[i]; peak = entry; }
    else if (inPos) {
      peak = Math.max(peak, slice[i]);
      if (r > 65 || m < 0) {
        const ret = (slice[i] - entry) / entry;
        equity *= 1 + ret;
        rets.push(ret);
        if (ret > 0) wins++;
        trades++;
        peakEq = Math.max(peakEq, equity);
        maxDD = Math.min(maxDD, (equity - peakEq) / peakEq);
        inPos = false;
      }
    }
  }
  const winRate = trades ? +((wins / trades) * 100).toFixed(1) : 0;
  const totalReturnPct = +((equity - 1) * 100).toFixed(2);
  const mean = rets.reduce((x, y) => x + y, 0) / (rets.length || 1);
  const variance = rets.reduce((x, y) => x + (y - mean) ** 2, 0) / (rets.length || 1);
  const sharpe = variance > 0 ? +(mean / Math.sqrt(variance) * Math.sqrt(252 / 20)).toFixed(2) : 0;
  return {
    symbol: a.symbol, trades, winRate, totalReturnPct,
    maxDrawdownPct: +(maxDD * 100).toFixed(2), sharpe,
  };
}

export function backtestAll(assets: ScannedAsset[]): BacktestResult[] {
  return assets.map(backtestAsset);
}
