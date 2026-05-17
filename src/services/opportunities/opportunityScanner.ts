// Opportunity Scanner — detects momentum spikes, volatility compression,
// reversals and sentiment divergences. Probabilistic language only.
import type { MarketQuote } from "@/services/market/marketData";
import type { Signal } from "@/services/signals/signalEngine";
import type { MarketSentimentScore } from "@/services/analysis/marketSentiment";

export type OpportunityKind = "Momentum" | "Compression" | "Reversal" | "Divergence" | "Breakout";
export type EntryBias = "Long bias" | "Short bias" | "Range" | "Wait";

export interface Opportunity {
  id: string;
  asset: string;
  assetName: string;
  kind: OpportunityKind;
  score: number; // 0-100
  confidence: number; // 0-100
  urgency: number; // 0-100
  entryBias: EntryBias;
  explanation: string;
  timestamp: number;
}

function std(arr: number[]): number {
  const m = arr.reduce((a, b) => a + b, 0) / arr.length;
  return Math.sqrt(arr.reduce((s, v) => s + (v - m) * (v - m), 0) / arr.length);
}

function rangePct(arr: number[]): number {
  const lo = Math.min(...arr), hi = Math.max(...arr);
  return ((hi - lo) / lo) * 100;
}

export function scanOpportunities(
  quotes: MarketQuote[],
  signals: Signal[],
  sentiment: MarketSentimentScore,
): Opportunity[] {
  const out: Opportunity[] = [];
  const sigMap = new Map(signals.map((s) => [s.asset, s]));

  for (const q of quotes) {
    const sig = sigMap.get(q.key);
    const r = q.history.map((v, i, a) => i ? (v - a[i - 1]) / a[i - 1] : 0).slice(1);
    const vol = std(r) * 100;
    const range = rangePct(q.history);
    const mom = q.momentum;

    // Momentum spike
    if (Math.abs(mom) > 1.5 && q.volatility > 35) {
      const long = mom > 0;
      out.push({
        id: `op-${q.key}-mom-${Date.now()}`,
        asset: q.key, assetName: q.name,
        kind: "Momentum",
        score: Math.min(95, 55 + Math.round(Math.abs(mom) * 8)),
        confidence: sig?.confidence ?? 60,
        urgency: Math.min(95, 50 + Math.round(q.volatility * 0.5)),
        entryBias: long ? "Long bias" : "Short bias",
        explanation: `Momentum impulse (${mom > 0 ? "+" : ""}${mom.toFixed(2)}%) with elevated participation. Probabilistic edge favors ${long ? "continuation higher" : "further downside"} while RSI ${sig?.rsi ?? "—"} stays directional.`,
        timestamp: Date.now(),
      });
    }

    // Volatility compression — low vol + tight range
    if (vol < 0.4 && range < 1.5) {
      out.push({
        id: `op-${q.key}-cmp-${Date.now()}`,
        asset: q.key, assetName: q.name,
        kind: "Compression",
        score: Math.min(90, 60 + Math.round((2 - vol) * 12)),
        confidence: 58,
        urgency: 45,
        entryBias: "Wait",
        explanation: `Volatility compression detected — realized vol ${vol.toFixed(2)}% with range ${range.toFixed(2)}%. Historically resolves into a directional expansion; size only on confirmed break.`,
        timestamp: Date.now(),
      });
    }

    // Reversal — RSI extreme with weakening momentum
    if (sig && ((sig.rsi < 30 && mom > -0.5) || (sig.rsi > 70 && mom < 0.5))) {
      const long = sig.rsi < 30;
      out.push({
        id: `op-${q.key}-rev-${Date.now()}`,
        asset: q.key, assetName: q.name,
        kind: "Reversal",
        score: Math.min(92, 60 + Math.round(Math.abs(50 - sig.rsi))),
        confidence: Math.max(55, sig.confidence - 5),
        urgency: 60,
        entryBias: long ? "Long bias" : "Short bias",
        explanation: `RSI ${sig.rsi} signals ${long ? "oversold" : "overbought"} stress as momentum stabilizes. Mean-reversion edge increases; favor staged entries with defined risk.`,
        timestamp: Date.now(),
      });
    }

    // Sentiment divergence — bearish macro + bullish single-name momentum (or vice versa)
    const macro = sentiment.score;
    if ((macro < 35 && mom > 1.2) || (macro > 65 && mom < -1.2)) {
      const long = mom > 0;
      out.push({
        id: `op-${q.key}-div-${Date.now()}`,
        asset: q.key, assetName: q.name,
        kind: "Divergence",
        score: 70,
        confidence: 55,
        urgency: 55,
        entryBias: long ? "Long bias" : "Short bias",
        explanation: `${q.name} diverging from broad sentiment (${sentiment.zone}, ${macro}/100). Idiosyncratic strength can persist but tighten risk if regime shifts.`,
        timestamp: Date.now(),
      });
    }
  }

  return out
    .sort((a, b) => b.score + b.urgency / 2 - (a.score + a.urgency / 2))
    .slice(0, 6);
}
