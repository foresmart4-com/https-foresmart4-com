// Breakout prediction — detects squeeze conditions and directional breakout
// likelihood from existing quote history.
import type { MarketQuote, AssetKey } from "@/services/market/marketData";

export type BreakoutDirection = "up" | "down" | "neutral";

export interface BreakoutReport {
  asset: AssetKey;
  assetName: string;
  direction: BreakoutDirection;
  confidence: number;        // 0-100
  estimatedMovePct: number;  // projected move strength
  squeeze: number;           // 0-100 squeeze intensity
  pressure: number;          // 0-100 S/R pressure
  riskLevel: "low" | "medium" | "high";
  note: string;
}

function stdev(arr: number[]): number {
  if (arr.length < 2) return 0;
  const m = arr.reduce((a, b) => a + b, 0) / arr.length;
  return Math.sqrt(arr.reduce((s, x) => s + (x - m) ** 2, 0) / arr.length);
}

export function predictBreakout(q: MarketQuote): BreakoutReport {
  const h = q.history;
  const n = h.length;
  const last = h[n - 1];

  // Bollinger-style squeeze: shrinking band width
  const recent = h.slice(-Math.max(5, Math.floor(n / 3)));
  const older = h.slice(0, Math.max(5, Math.floor(n / 3)));
  const sR = stdev(recent), sO = stdev(older) || 1e-9;
  const ratio = sR / sO;
  const squeeze = Math.max(0, Math.min(100, Math.round((1 - ratio) * 110)));

  // Support / resistance pressure: proximity to recent highs/lows
  const hi = Math.max(...h);
  const lo = Math.min(...h);
  const range = hi - lo || 1e-9;
  const posInRange = (last - lo) / range; // 0..1
  const pressure = Math.round(Math.abs(posInRange - 0.5) * 200); // 0-100

  // Direction: slope sign weighted by position in range
  const slope = (last - h[0]) / (h[0] || 1) * 100;
  let direction: BreakoutDirection = "neutral";
  if (slope > 0.1 && posInRange > 0.55) direction = "up";
  else if (slope < -0.1 && posInRange < 0.45) direction = "down";

  // Estimated move proportional to historical range and squeeze
  const histRangePct = (range / (lo || 1)) * 100;
  const estimatedMovePct = +(histRangePct * (0.45 + squeeze / 250)).toFixed(2);

  const confidence = Math.max(25, Math.min(95, Math.round(
    squeeze * 0.5 + pressure * 0.25 + Math.abs(slope) * 8 + (direction === "neutral" ? -10 : 5),
  )));

  const riskLevel: BreakoutReport["riskLevel"] =
    q.volatility > 70 ? "high" : q.volatility > 40 ? "medium" : "low";

  const note = direction === "neutral"
    ? `Range-bound; squeeze ${squeeze}/100, no clear directional bias yet.`
    : `${direction === "up" ? "Upside" : "Downside"} breakout setup forming — squeeze ${squeeze}, pressure ${pressure}.`;

  return {
    asset: q.key, assetName: q.name,
    direction, confidence, estimatedMovePct,
    squeeze, pressure, riskLevel, note,
  };
}

export function predictAllBreakouts(quotes: MarketQuote[]): BreakoutReport[] {
  return quotes.map(predictBreakout).sort((a, b) => b.confidence - a.confidence);
}
