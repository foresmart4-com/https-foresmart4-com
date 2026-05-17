// Exit Intelligence Engine — produces take-profit ladder, defensive stop,
// and a simple trailing rule using volatility + momentum context.
import type { MarketQuote, AssetKey } from "@/services/market/marketData";
import type { CalibratedSignal } from "@/services/quant/confidenceEngine";
import type { MarketSentimentScore } from "@/services/analysis/marketSentiment";

export interface ExitPlan {
  asset: AssetKey;
  assetName: string;
  bias: "long" | "short" | "neutral";
  takeProfit: number[];     // 2–3 ladder targets
  defensiveStop: number;
  trailingTrigger: number;  // price after which trailing activates
  trailingDistancePct: number;
  exhaustionRisk: number;   // 0-100
  confidence: number;       // 0-100
  rationale: string;
}

export function buildExitPlan(
  q: MarketQuote,
  sig: CalibratedSignal | undefined,
  sentiment: MarketSentimentScore,
): ExitPlan {
  const h = q.history;
  const last = q.price;
  const hi = Math.max(...h);
  const lo = Math.min(...h);
  const range = (hi - lo) || last * 0.01;
  const volPct = q.volatility / 100;

  const bias: ExitPlan["bias"] = !sig || sig.action === "HOLD"
    ? "neutral"
    : sig.action === "BUY" ? "long" : "short";

  // ATR-like unit scales with volatility
  const unit = Math.max(last * 0.004, range * (0.35 + volPct * 0.4));

  let takeProfit: number[];
  let defensiveStop: number;
  let trailingTrigger: number;

  if (bias === "long") {
    takeProfit      = [last + unit * 1.0, last + unit * 1.8, last + unit * 2.8].map((v) => +v.toFixed(4));
    defensiveStop   = +(last - unit * 1.1).toFixed(4);
    trailingTrigger = +(last + unit * 1.3).toFixed(4);
  } else if (bias === "short") {
    takeProfit      = [last - unit * 1.0, last - unit * 1.8, last - unit * 2.8].map((v) => +v.toFixed(4));
    defensiveStop   = +(last + unit * 1.1).toFixed(4);
    trailingTrigger = +(last - unit * 1.3).toFixed(4);
  } else {
    takeProfit      = [+(last + unit).toFixed(4), +(last + unit * 1.6).toFixed(4)];
    defensiveStop   = +(last - unit * 0.9).toFixed(4);
    trailingTrigger = +(last + unit).toFixed(4);
  }

  // Exhaustion risk = momentum stretched + volatility expanding + sentiment extreme
  const stretched = Math.abs(q.momentum) > 6 ? 30 : Math.abs(q.momentum) > 3 ? 15 : 0;
  const volExp = q.volatility > 70 ? 30 : q.volatility > 50 ? 18 : 6;
  const sentExtreme = Math.abs(sentiment.score) > 70 ? 18 : 6;
  const exhaustionRisk = Math.min(100, stretched + volExp + sentExtreme + 10);

  const calConf = sig?.calibratedConfidence ?? 40;
  const confidence = Math.max(20, Math.min(92, Math.round(calConf * 0.6 + (100 - exhaustionRisk) * 0.35)));

  const trailingDistancePct = +(0.6 + volPct * 1.6).toFixed(2);

  const rationale = bias === "neutral"
    ? `No active position bias — exits framed as defensive brackets around ${last.toFixed(2)}.`
    : `${bias === "long" ? "Scale out into strength" : "Cover into weakness"} at ladder; trail after ${trailingTrigger}. Exhaustion risk ${exhaustionRisk}/100.`;

  return {
    asset: q.key, assetName: q.name, bias,
    takeProfit, defensiveStop, trailingTrigger, trailingDistancePct,
    exhaustionRisk, confidence, rationale,
  };
}

export function buildAllExitPlans(
  quotes: MarketQuote[],
  signals: CalibratedSignal[],
  sentiment: MarketSentimentScore,
): ExitPlan[] {
  const sigMap = new Map(signals.map((s) => [s.asset, s]));
  return quotes.map((q) => buildExitPlan(q, sigMap.get(q.key), sentiment));
}
