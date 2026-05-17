// Reasoning Engine — institutional-style narratives explaining changes in
// signals, risk, momentum and AI conviction. Probabilistic, never absolute.
import type { Signal } from "@/services/signals/signalEngine";
import type { MarketQuote } from "@/services/market/marketData";
import type { MarketSentimentScore } from "@/services/analysis/marketSentiment";

export type ReasoningKind = "Signal" | "Risk" | "Momentum" | "Conviction" | "Macro";

export interface ReasoningNote {
  id: string;
  kind: ReasoningKind;
  asset?: string;
  title: string;
  body: string;
  confidence: number; // 0-100
  timestamp: number;
}

function band(v: number): string {
  if (v >= 80) return "high-conviction";
  if (v >= 65) return "constructive";
  if (v >= 50) return "balanced";
  if (v >= 35) return "cautious";
  return "low-conviction";
}

export function generateReasoning(
  quotes: MarketQuote[],
  signals: Signal[],
  sentiment: MarketSentimentScore,
): ReasoningNote[] {
  const notes: ReasoningNote[] = [];
  const now = Date.now();

  const top = [...signals].sort((a, b) => b.confidence - a.confidence)[0];
  if (top) {
    notes.push({
      id: `rsn-sig-${top.asset}-${now}`,
      kind: "Signal", asset: top.assetName,
      title: `${top.assetName}: ${top.action} bias ${band(top.confidence)}`,
      body: `Setup driven by RSI ${top.rsi}, MACD ${top.macd}, news bias ${top.newsBias > 0 ? "+" : ""}${top.newsBias}. Composite read leans ${top.action === "HOLD" ? "two-way" : top.action === "BUY" ? "constructive" : "defensive"} with ${top.confidence}% conviction. Probabilistic edge — not deterministic; size to risk ${top.risk}/100.`,
      confidence: top.confidence, timestamp: now,
    });
  }

  // Risk note
  const avgVol = quotes.reduce((s, q) => s + q.volatility, 0) / Math.max(1, quotes.length);
  const riskTone = avgVol > 55 ? "elevated" : avgVol > 35 ? "normalising" : "subdued";
  notes.push({
    id: `rsn-risk-${now}`,
    kind: "Risk",
    title: `Cross-asset risk ${riskTone}`,
    body: `Realised volatility averages ${avgVol.toFixed(0)} across tracked assets while sentiment sits in ${sentiment.zone} (${sentiment.score}/100). Reward-to-risk improves when volatility compresses into a directional regime — current state argues for ${riskTone === "elevated" ? "smaller size and wider stops" : "selective additions on confirmation"}.`,
    confidence: 70, timestamp: now,
  });

  // Momentum weakening / strengthening leader
  const ranked = [...quotes].sort((a, b) => Math.abs(b.momentum) - Math.abs(a.momentum));
  const leader = ranked[0];
  if (leader) {
    const dir = leader.momentum > 0 ? "strengthening" : "weakening";
    notes.push({
      id: `rsn-mom-${leader.key}-${now}`,
      kind: "Momentum", asset: leader.name,
      title: `${leader.name} momentum ${dir}`,
      body: `Trailing-window drift of ${leader.momentum > 0 ? "+" : ""}${leader.momentum.toFixed(2)}% with volatility ${leader.volatility}/100. Probability of continuation rises while ${dir === "strengthening" ? "breadth confirms" : "lower highs persist"}, but mean-reversion risk grows once the move extends beyond two standard deviations.`,
      confidence: 65, timestamp: now,
    });
  }

  // Conviction note
  const avgConf = signals.reduce((s, x) => s + x.confidence, 0) / Math.max(1, signals.length);
  notes.push({
    id: `rsn-conv-${now}`,
    kind: "Conviction",
    title: `AI conviction band: ${band(avgConf)}`,
    body: `Weighted signal confidence averages ${avgConf.toFixed(0)}%. Treat as a range, not a forecast — outcomes are probability-weighted. The model favours ${signals.filter((s) => s.action === "BUY").length} long / ${signals.filter((s) => s.action === "SELL").length} short / ${signals.filter((s) => s.action === "HOLD").length} hold across the universe.`,
    confidence: Math.round(avgConf), timestamp: now,
  });

  return notes;
}
