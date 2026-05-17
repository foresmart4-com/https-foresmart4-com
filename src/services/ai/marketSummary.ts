import type { MarketQuote } from "@/services/market/marketData";
import type { Signal } from "@/services/signals/signalEngine";

export type Sentiment = "bullish" | "bearish" | "neutral";
export type RiskLevel = "low" | "moderate" | "elevated" | "high";

export interface MarketSummary {
  sentiment: Sentiment;
  riskLevel: RiskLevel;
  focusAsset: string;
  headline: string;
  body: string;
  generatedAt: number;
}

const bullish = [
  "Market sentiment remains constructive as risk assets push higher with broadening participation.",
  "Momentum across major benchmarks continues to favor bulls amid healthy volume confirmation.",
  "Risk appetite improves as leadership rotates into high-beta names and crypto majors strengthen.",
];
const bearish = [
  "Risk-off tone dominates as defensive flows accelerate and breadth deteriorates.",
  "Sentiment turns cautious as momentum fades and volatility expands across cyclicals.",
  "Markets show distribution as overhead supply weighs on rallies and credit spreads widen.",
];
const neutral = [
  "Markets trade in a balanced range as participants digest mixed macro signals.",
  "Price action remains constructive but range-bound — awaiting the next catalyst.",
  "Sentiment is balanced; rotation continues beneath the surface without a clear directional bias.",
];

function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }

export function buildSummary(quotes: MarketQuote[], signals: Signal[]): MarketSummary {
  const avgMom = quotes.reduce((s, q) => s + q.momentum, 0) / Math.max(1, quotes.length);
  const avgVol = quotes.reduce((s, q) => s + q.volatility, 0) / Math.max(1, quotes.length);
  const sentiment: Sentiment = avgMom > 0.4 ? "bullish" : avgMom < -0.4 ? "bearish" : "neutral";

  const riskLevel: RiskLevel =
    avgVol > 65 ? "high" : avgVol > 45 ? "elevated" : avgVol > 25 ? "moderate" : "low";

  const top = [...signals].sort((a, b) => b.confidence - a.confidence)[0];
  const focusAsset = top ? `${top.assetName} (${top.action})` : "Bitcoin";

  const bank = sentiment === "bullish" ? bullish : sentiment === "bearish" ? bearish : neutral;
  const headline = pick(bank);

  const leaders = quotes.filter((q) => q.changePct > 0).sort((a, b) => b.changePct - a.changePct).slice(0, 2);
  const laggards = quotes.filter((q) => q.changePct < 0).sort((a, b) => a.changePct - b.changePct).slice(0, 2);

  const lead = leaders.map((q) => `${q.name} +${q.changePct.toFixed(2)}%`).join(", ") || "—";
  const lag = laggards.map((q) => `${q.name} ${q.changePct.toFixed(2)}%`).join(", ") || "—";

  const body =
    `${headline} Leaders: ${lead}. Laggards: ${lag}. ` +
    `Cross-asset volatility is ${riskLevel}. Highest-conviction setup: ${focusAsset}` +
    (top ? ` with ${top.confidence}% confidence.` : ".");

  return { sentiment, riskLevel, focusAsset, headline, body, generatedAt: Date.now() };
}
