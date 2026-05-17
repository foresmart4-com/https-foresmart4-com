// Signal quality filter — rejects noisy/unstable signals and grades the rest.
import type { CalibratedSignal } from "@/services/quant/confidenceEngine";
import type { TimeframeReport } from "@/services/quant/multiTimeframeEngine";
import type { RegimeReport } from "@/services/quant/regimeDetection";
import type { MarketSentimentScore } from "@/services/analysis/marketSentiment";
import type { LiquidityFlowReport } from "@/services/edge/liquidityFlow";
import type { MarketQuote, AssetKey } from "@/services/market/marketData";

export type QualityGrade = "A" | "B" | "C" | "D";

export interface FilteredSignal {
  asset: AssetKey;
  assetName: string;
  action: CalibratedSignal["action"];
  grade: QualityGrade;
  accepted: boolean;
  institutionalConfidence: number; // 0-100
  noiseScore: number;              // 0-100
  rejectReason?: string;
  notes: string[];
}

const BAD_REGIMES: RegimeReport["regime"][] = ["Panic", "High Volatility"];

export function filterSignals(
  signals: CalibratedSignal[],
  timeframes: TimeframeReport[],
  regime: RegimeReport,
  sentiment: MarketSentimentScore,
  liquidity: LiquidityFlowReport,
  quotes: MarketQuote[],
): FilteredSignal[] {
  const tfMap = new Map(timeframes.map((t) => [t.asset, t]));
  const qMap = new Map(quotes.map((q) => [q.key, q]));
  const regimeBad = BAD_REGIMES.includes(regime.regime);
  const sentExtreme = Math.abs(sentiment.score - 50) > 35;
  const liqWeak = liquidity.concentration > 70;

  return signals.map((s) => {
    const tf = tfMap.get(s.asset);
    const q = qMap.get(s.asset);
    const notes: string[] = [];
    let penalty = 0;

    const confStability = 100 - s.uncertainty;
    if (s.uncertainty > 55) { penalty += 18; notes.push("High uncertainty"); }
    if (tf && tf.agreement < 45) { penalty += 16; notes.push("MTF disagreement"); }
    if (q && q.volatility > 75) { penalty += 14; notes.push("Volatility extreme"); }
    if (regimeBad) { penalty += 12; notes.push(`Hostile regime: ${regime.regime}`); }
    if (sentExtreme) { penalty += 8; notes.push("Sentiment overextended"); }
    if (liqWeak) { penalty += 8; notes.push("Liquidity concentrated"); }

    const noiseScore = Math.max(0, Math.min(100, Math.round(
      (q ? Math.max(0, q.volatility - 40) * 0.8 : 0)
      + (tf ? Math.max(0, 60 - tf.agreement) * 0.6 : 20)
      + s.uncertainty * 0.4 + (regimeBad ? 18 : 0),
    )));

    const institutionalConfidence = Math.max(0, Math.min(100, Math.round(
      s.calibratedConfidence * 0.55 + confStability * 0.2
      + (tf?.agreement ?? 50) * 0.15 + (100 - noiseScore) * 0.1 - penalty * 0.35,
    )));

    const grade: QualityGrade =
      institutionalConfidence >= 78 ? "A" :
      institutionalConfidence >= 62 ? "B" :
      institutionalConfidence >= 48 ? "C" : "D";

    const accepted = grade !== "D" && s.action !== "HOLD";
    const rejectReason = !accepted
      ? (s.action === "HOLD" ? "No directional edge" : "Quality below institutional threshold")
      : undefined;

    return {
      asset: s.asset, assetName: s.assetName, action: s.action,
      grade, accepted, institutionalConfidence, noiseScore, rejectReason, notes,
    };
  }).sort((a, b) => b.institutionalConfidence - a.institutionalConfidence);
}
