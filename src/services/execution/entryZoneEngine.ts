// Entry Zone Engine — calculates tactical entry zones with conservative,
// optimal and aggressive levels based on volatility, structure and momentum.
import type { MarketQuote, AssetKey } from "@/services/market/marketData";
import type { CalibratedSignal } from "@/services/quant/confidenceEngine";
import type { TimeframeReport } from "@/services/quant/multiTimeframeEngine";
import type { BreakoutReport } from "@/services/edge/breakoutPrediction";

export type EntryQuality = "excellent" | "good" | "fair" | "poor";

export interface EntryZone {
  asset: AssetKey;
  assetName: string;
  bias: "long" | "short" | "neutral";
  conservative: number;
  optimal: number;
  aggressive: number;
  rangeLow: number;
  rangeHigh: number;
  quality: EntryQuality;
  timing: number;        // 0-100
  confidence: number;    // 0-100
  reasoning: string;
}

function avg(xs: number[]): number { return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0; }

export function calculateEntryZone(
  q: MarketQuote,
  sig: CalibratedSignal | undefined,
  tf: TimeframeReport | undefined,
  br: BreakoutReport | undefined,
): EntryZone {
  const h = q.history;
  const last = q.price;
  const hi = Math.max(...h);
  const lo = Math.min(...h);
  const mid = avg(h);
  const range = (hi - lo) || last * 0.01;
  const volPct = q.volatility / 100;

  const bias: EntryZone["bias"] = !sig || sig.action === "HOLD"
    ? "neutral"
    : sig.action === "BUY" ? "long" : "short";

  // Offset scales with volatility — calmer markets need tighter zones
  const offset = Math.max(last * 0.0015, range * (0.12 + volPct * 0.25));

  let conservative: number, optimal: number, aggressive: number;
  if (bias === "long") {
    conservative = +(Math.min(last, mid) - offset * 1.2).toFixed(4);
    optimal      = +(Math.min(last, mid) - offset * 0.4).toFixed(4);
    aggressive   = +last.toFixed(4);
  } else if (bias === "short") {
    conservative = +(Math.max(last, mid) + offset * 1.2).toFixed(4);
    optimal      = +(Math.max(last, mid) + offset * 0.4).toFixed(4);
    aggressive   = +last.toFixed(4);
  } else {
    conservative = +(last - offset).toFixed(4);
    optimal      = +last.toFixed(4);
    aggressive   = +(last + offset).toFixed(4);
  }

  const rangeLow  = +Math.min(conservative, optimal, aggressive).toFixed(4);
  const rangeHigh = +Math.max(conservative, optimal, aggressive).toFixed(4);

  // Timing quality — higher when MTF aligns, breakout pressure builds, volatility moderate
  const tfAlign  = tf?.agreement ?? 50;
  const squeeze  = br?.squeeze ?? 30;
  const pressure = br?.pressure ?? 30;
  const volPenalty = q.volatility > 70 ? -18 : q.volatility < 12 ? -8 : 6;
  const timing = Math.max(0, Math.min(100, Math.round(
    tfAlign * 0.45 + squeeze * 0.2 + pressure * 0.15 + volPenalty + 10,
  )));

  const calConf = sig?.calibratedConfidence ?? 40;
  const confidence = Math.max(15, Math.min(95, Math.round(calConf * 0.65 + timing * 0.35)));

  const quality: EntryQuality =
    timing >= 75 && confidence >= 70 ? "excellent" :
    timing >= 60 && confidence >= 55 ? "good" :
    timing >= 40 ? "fair" : "poor";

  const reasoning = bias === "neutral"
    ? `Range-bound; no directional edge. Watch ${rangeLow}–${rangeHigh}.`
    : `${bias === "long" ? "Long" : "Short"} bias — scale entries ${rangeLow}–${rangeHigh}; timing ${timing}/100, MTF ${tfAlign}%.`;

  return {
    asset: q.key, assetName: q.name, bias,
    conservative, optimal, aggressive,
    rangeLow, rangeHigh, quality, timing, confidence, reasoning,
  };
}

export function calculateAllEntryZones(
  quotes: MarketQuote[],
  signals: CalibratedSignal[],
  timeframes: TimeframeReport[],
  breakouts: BreakoutReport[],
): EntryZone[] {
  const sigMap = new Map(signals.map((s) => [s.asset, s]));
  const tfMap  = new Map(timeframes.map((t) => [t.asset, t]));
  const brMap  = new Map(breakouts.map((b) => [b.asset, b]));
  return quotes.map((q) => calculateEntryZone(q, sigMap.get(q.key), tfMap.get(q.key), brMap.get(q.key)))
    .sort((a, b) => b.confidence - a.confidence);
}
