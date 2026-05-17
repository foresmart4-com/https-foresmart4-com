// Strategy adaptation — adjusts behavior based on the current regime.
import type { RegimeReport } from "@/services/quant/regimeDetection";
import type { MarketSentimentScore } from "@/services/analysis/marketSentiment";

export type AdaptiveBias = "aggressive" | "constructive" | "neutral" | "defensive" | "preserve";

export interface StrategyAdaptation {
  bias: AdaptiveBias;
  cautionLevel: number;    // 0-100
  aggressionLevel: number; // 0-100
  recommendation: string;
  focus: string;
  rules: string[];
}

export function adaptStrategy(
  regime: RegimeReport,
  sentiment: MarketSentimentScore,
  avgVolatility: number,
): StrategyAdaptation {
  let bias: AdaptiveBias = "neutral";
  let cautionLevel = 40;
  let aggressionLevel = 40;
  const rules: string[] = [];
  let focus = "Balanced positioning across regimes.";
  let recommendation = "Maintain framework discipline; no tactical shift required.";

  switch (regime.regime) {
    case "Trending Bullish":
    case "Risk-On":
      bias = "constructive";
      aggressionLevel = 65; cautionLevel = 35;
      focus = "Prioritize momentum continuation; let winners run.";
      recommendation = "Lean into trend-aligned breakouts; avoid counter-trend fades.";
      rules.push("Favor momentum-aligned entries.", "Trail stops to lock gains.", "Avoid mean-reversion trades.");
      break;
    case "Trending Bearish":
    case "Risk-Off":
      bias = "defensive";
      aggressionLevel = 30; cautionLevel = 70;
      focus = "Capital preservation; defensive sector rotation.";
      recommendation = "Reduce gross exposure; prefer safe-haven and dollar strength.";
      rules.push("Cut high-beta exposure.", "Tighten stops aggressively.", "Avoid catching falling knives.");
      break;
    case "Sideways":
      bias = "neutral";
      aggressionLevel = 35; cautionLevel = 55;
      focus = "Range-bound — fade extremes, smaller size.";
      recommendation = "Lower conviction across breakouts; expect chop.";
      rules.push("Discount breakout signals.", "Trade smaller positions.", "Wait for confirmation.");
      break;
    case "High Volatility":
      bias = "defensive";
      aggressionLevel = 25; cautionLevel = 80;
      focus = "Volatility regime — survival over prediction.";
      recommendation = "Reduce size sharply; widen stops or step aside.";
      rules.push("Halve typical position size.", "Avoid clustered correlated bets.", "Wait for vol contraction before re-engaging.");
      break;
    case "Panic":
      bias = "preserve";
      aggressionLevel = 10; cautionLevel = 95;
      focus = "Panic regime — capital preservation is the only objective.";
      recommendation = "Avoid new entries; protect capital and re-assess once volatility cools.";
      rules.push("No new directional risk.", "Hedge or de-risk existing exposure.", "Document plan for re-entry.");
      break;
  }

  // Sentiment overrides
  if (sentiment.score < 25 && bias !== "preserve") {
    cautionLevel = Math.min(100, cautionLevel + 10);
    rules.push("Extreme fear — historically supportive long-term, but near-term risk elevated.");
  }
  if (sentiment.score > 75 && bias === "constructive") {
    cautionLevel = Math.min(100, cautionLevel + 8);
    rules.push("Extreme greed — trim aggression; complacency risk rising.");
  }
  if (avgVolatility > 70) {
    aggressionLevel = Math.max(10, aggressionLevel - 10);
    cautionLevel = Math.min(100, cautionLevel + 10);
  }

  return { bias, cautionLevel, aggressionLevel, recommendation, focus, rules };
}
