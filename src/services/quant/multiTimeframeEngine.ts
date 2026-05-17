// Multi-timeframe analysis — derives synthetic TF slices from the 24-point
// history buffer to estimate trend / momentum / volatility per timeframe
// and compute alignment scores. Lightweight, fully client-side.
import type { MarketQuote, AssetKey } from "@/services/market/marketData";

export type Timeframe = "5m" | "15m" | "1h" | "4h" | "1D";

export interface TimeframeReading {
  tf: Timeframe;
  trend: "up" | "down" | "flat";
  momentum: number; // -100..100
  volatility: number; // 0..100
  strength: number; // 0..100
  aligned: 1 | 0 | -1; // bullish / neutral / bearish
}

export interface TimeframeReport {
  asset: AssetKey;
  assetName: string;
  readings: TimeframeReading[];
  agreement: number; // 0..100 — share of TFs agreeing with dominant bias
  shortBias: "bullish" | "bearish" | "neutral"; // 5m + 15m + 1h
  macroBias: "bullish" | "bearish" | "neutral"; // 4h + 1D
}

const TF_WINDOWS: Record<Timeframe, number> = {
  "5m": 4, "15m": 6, "1h": 8, "4h": 12, "1D": 24,
};

function slice(history: number[], window: number): number[] {
  if (history.length === 0) return [];
  return history.slice(-Math.min(window, history.length));
}

function readTF(tf: Timeframe, history: number[], baseVol: number): TimeframeReading {
  const slc = slice(history, TF_WINDOWS[tf]);
  if (slc.length < 2) return { tf, trend: "flat", momentum: 0, volatility: 0, strength: 0, aligned: 0 };
  const first = slc[0];
  const last = slc[slc.length - 1];
  const pct = ((last - first) / first) * 100;
  const momentum = Math.max(-100, Math.min(100, pct * 8));
  // std-dev based volatility
  const mean = slc.reduce((a, b) => a + b, 0) / slc.length;
  const variance = slc.reduce((a, b) => a + (b - mean) ** 2, 0) / slc.length;
  const stdev = Math.sqrt(variance) / mean * 100;
  const volatility = Math.min(100, +(stdev * 18 + baseVol * 8).toFixed(1));
  const strength = Math.min(100, Math.abs(momentum) * 0.9 + 10);
  const trend: TimeframeReading["trend"] = pct > 0.05 ? "up" : pct < -0.05 ? "down" : "flat";
  const aligned: 1 | 0 | -1 = trend === "up" ? 1 : trend === "down" ? -1 : 0;
  return { tf, trend, momentum: +momentum.toFixed(1), volatility, strength: +strength.toFixed(1), aligned };
}

export function analyzeAsset(q: MarketQuote): TimeframeReport {
  const tfs: Timeframe[] = ["5m", "15m", "1h", "4h", "1D"];
  const readings = tfs.map((tf) => readTF(tf, q.history, q.volatility / 12));
  const bulls = readings.filter((r) => r.aligned === 1).length;
  const bears = readings.filter((r) => r.aligned === -1).length;
  const dominant = bulls > bears ? bulls : bears > bulls ? bears : 0;
  const agreement = Math.round((dominant / readings.length) * 100);

  const short = readings.slice(0, 3).reduce((s, r) => s + r.aligned, 0);
  const macro = readings.slice(3).reduce((s, r) => s + r.aligned, 0);
  const biasOf = (n: number): TimeframeReport["shortBias"] =>
    n > 0 ? "bullish" : n < 0 ? "bearish" : "neutral";

  return {
    asset: q.key,
    assetName: q.name,
    readings,
    agreement,
    shortBias: biasOf(short),
    macroBias: biasOf(macro),
  };
}

export function analyzeAll(quotes: MarketQuote[]): TimeframeReport[] {
  return quotes.map(analyzeAsset);
}
