// Market regime detection — classifies the current market into one of
// seven regimes using volatility, momentum, sentiment, news pressure
// and correlation behaviour. Pure functions, no async.
import type { MarketQuote } from "@/services/market/marketData";
import type { MarketSentimentScore } from "@/services/analysis/marketSentiment";
import type { CorrelationPair } from "@/services/correlation/correlationEngine";
import type { NewsItem } from "@/services/news/newsImpact";

export type Regime =
  | "Trending Bullish"
  | "Trending Bearish"
  | "Sideways"
  | "High Volatility"
  | "Panic"
  | "Risk-On"
  | "Risk-Off";

export interface RegimeReport {
  regime: Regime;
  confidence: number; // 0..100
  explanation: string;
  strategyHint: string;
  metrics: {
    avgVol: number;
    avgMomentum: number;
    sentiment: number;
    newsPressure: number;
    corrDispersion: number;
  };
}

function avg(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}

export function detectRegime(
  quotes: MarketQuote[],
  sentiment: MarketSentimentScore,
  news: NewsItem[],
  correlations: CorrelationPair[],
): RegimeReport {
  const avgVol = avg(quotes.map((q) => q.volatility));
  const avgMomentum = avg(quotes.map((q) => q.momentum));
  const sScore = sentiment.score; // -100..100
  const highImpactNews = news.filter((n) => n.impact === "High").length;
  const negNews = news.filter((n) => n.sentiment === "negative").length;
  const newsPressure = Math.min(100, highImpactNews * 25 + negNews * 10);
  const corrAbs = correlations.map((c) => Math.abs(c.coefficient));
  const corrDispersion = corrAbs.length
    ? Math.sqrt(avg(corrAbs.map((c) => (c - avg(corrAbs)) ** 2))) * 100
    : 0;

  let regime: Regime = "Sideways";
  let confidence = 55;
  let explanation = "Mixed signals across momentum, volatility and sentiment.";
  let strategyHint = "Stay selective, prefer mean-reversion setups and tight risk.";

  if (avgVol > 70 && newsPressure > 60) {
    regime = "Panic";
    confidence = 88;
    explanation = "Elevated volatility colliding with high-impact negative news flow.";
    strategyHint = "Reduce exposure, raise cash, avoid catching falling knives.";
  } else if (avgVol > 60) {
    regime = "High Volatility";
    confidence = 78;
    explanation = "Cross-asset volatility is well above normal — regime is unstable.";
    strategyHint = "Trim position sizes, widen stops, prefer optionality over directional bets.";
  } else if (avgMomentum > 25 && sScore > 25) {
    regime = "Trending Bullish";
    confidence = 82;
    explanation = "Positive momentum confirmed by constructive sentiment across assets.";
    strategyHint = "Favour trend-following on leaders; trail stops, do not pre-empt reversals.";
  } else if (avgMomentum < -25 && sScore < -25) {
    regime = "Trending Bearish";
    confidence = 82;
    explanation = "Negative momentum reinforced by deteriorating sentiment.";
    strategyHint = "Prefer defensives and hedges; fade rallies into structural resistance.";
  } else if (sScore > 35 && newsPressure < 30) {
    regime = "Risk-On";
    confidence = 72;
    explanation = "Sentiment skews constructive while news pressure remains contained.";
    strategyHint = "Lean into high-beta exposure but respect risk budgets.";
  } else if (sScore < -35 || newsPressure > 50) {
    regime = "Risk-Off";
    confidence = 74;
    explanation = "Sentiment is defensive and macro news pressure is rising.";
    strategyHint = "Rotate into quality, raise hedges, monitor correlations for stress.";
  } else if (Math.abs(avgMomentum) < 10 && avgVol < 40) {
    regime = "Sideways";
    confidence = 68;
    explanation = "Low momentum and contained volatility — range-bound conditions.";
    strategyHint = "Mean-reversion at range extremes; avoid breakout chases until volume returns.";
  }

  // Penalise confidence when correlations are unstable
  if (corrDispersion > 35) confidence = Math.max(40, confidence - 12);

  return {
    regime,
    confidence,
    explanation,
    strategyHint,
    metrics: {
      avgVol: +avgVol.toFixed(1),
      avgMomentum: +avgMomentum.toFixed(1),
      sentiment: +sScore.toFixed(1),
      newsPressure,
      corrDispersion: +corrDispersion.toFixed(1),
    },
  };
}
